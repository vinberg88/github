import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "../lib/security.js";

const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "admin", "manager", "contributor", "viewer"]).default("contributor")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500)
});

const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(500).optional(),
  allSessions: z.boolean().optional().default(false)
});

const revokeSessionParamsSchema = z.object({
  id: z.string().min(1)
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(8).max(200)
});

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_DAYS ?? 14);

function invalidPayload(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, issues: unknown) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}

function createRefreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

function getRequestMeta(request: { headers: { [key: string]: unknown }; ip: string }) {
  const userAgentValue = request.headers["user-agent"];

  return {
    userAgent: typeof userAgentValue === "string" ? userAgentValue.slice(0, 500) : null,
    ipAddress: request.ip
  };
}

function userView(member: {
  id: string;
  email: string;
  fullName: string;
  role: "owner" | "admin" | "manager" | "contributor" | "viewer";
  organizationId: string;
}) {
  return {
    id: member.id,
    email: member.email,
    fullName: member.fullName,
    role: member.role,
    organizationId: member.organizationId
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", { preHandler: app.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const exists = await prisma.member.findUnique({
      where: { email: parsed.data.email },
      select: { id: true }
    });

    if (exists) {
      return reply.code(409).send({ message: "Email already registered" });
    }

    const created = await prisma.member.create({
      data: {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        organizationId: request.user.organizationId,
        passwordHash: hashPassword(parsed.data.password)
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true
      }
    });

    return reply.code(201).send(created);
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const member = await prisma.member.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true,
        passwordHash: true,
        isActive: true
      }
    });

    if (!member?.passwordHash || !member.isActive) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const ok = verifyPassword(parsed.data.password, member.passwordHash);
    if (!ok) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    await prisma.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() }
    });

    const accessToken = await reply.jwtSign(
      {
        sub: member.id,
        email: member.email,
        role: member.role,
        organizationId: member.organizationId
      },
      {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN
      }
    );

    const refreshToken = generateOpaqueToken();
    const meta = getRequestMeta(request);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(refreshToken),
        memberId: member.id,
        organizationId: member.organizationId,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        lastUsedAt: new Date(),
        expiresAt: createRefreshExpiryDate()
      }
    });

    return {
      accessToken,
      refreshToken,
      user: userView(member)
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const now = new Date();
    const tokenHash = hashOpaqueToken(parsed.data.refreshToken);

    const trackedToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        memberId: true,
        revokedAt: true,
        expiresAt: true
      }
    });

    if (!trackedToken) {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }

    if (trackedToken.revokedAt || trackedToken.expiresAt <= now) {
      await prisma.refreshToken.updateMany({
        where: {
          memberId: trackedToken.memberId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      return reply.code(401).send({
        message: "Refresh token reuse detected. All sessions revoked. Please sign in again."
      });
    }

    const existing = await prisma.refreshToken.findFirst({
      where: {
        id: trackedToken.id,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      },
      include: {
        member: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            organizationId: true,
            isActive: true
          }
        }
      }
    });

    if (!existing?.member.isActive) {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }

    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now }
    });

    const nextRefreshToken = generateOpaqueToken();
    const meta = getRequestMeta(request);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(nextRefreshToken),
        memberId: existing.member.id,
        organizationId: existing.member.organizationId,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        lastUsedAt: now,
        expiresAt: createRefreshExpiryDate()
      }
    });

    const accessToken = await reply.jwtSign(
      {
        sub: existing.member.id,
        email: existing.member.email,
        role: existing.member.role,
        organizationId: existing.member.organizationId
      },
      {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN
      }
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: userView(existing.member)
    };
  });

  app.post("/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = logoutSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    if (parsed.data.allSessions) {
      await prisma.refreshToken.updateMany({
        where: {
          memberId: request.user.sub,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      return { status: "ok" };
    }

    if (!parsed.data.refreshToken) {
      return reply.code(400).send({ message: "refreshToken is required unless allSessions=true" });
    }

    await prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashOpaqueToken(parsed.data.refreshToken),
        memberId: request.user.sub,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { status: "ok" };
  });

  app.get("/auth/sessions", { preHandler: app.authenticate }, async (request) => {
    const now = new Date();

    const items = await prisma.refreshToken.findMany({
      where: {
        memberId: request.user.sub,
        organizationId: request.user.organizationId,
        revokedAt: null,
        expiresAt: {
          gt: now
        }
      },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      }
    });

    return {
      count: items.length,
      items
    };
  });

  app.delete("/auth/sessions/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = revokeSessionParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const updated = await prisma.refreshToken.updateMany({
      where: {
        id: parsed.data.id,
        memberId: request.user.sub,
        organizationId: request.user.organizationId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    if (updated.count === 0) {
      return reply.code(404).send({ message: "Session not found" });
    }

    return { status: "ok" };
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request) => {
    return prisma.member.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organizationId: true,
        isActive: true,
        lastLoginAt: true
      }
    });
  });

  app.post("/auth/change-password", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = updatePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const member = await prisma.member.findUnique({
      where: { id: request.user.sub },
      select: { id: true, passwordHash: true }
    });

    if (!member?.passwordHash) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    const valid = verifyPassword(parsed.data.currentPassword, member.passwordHash);
    if (!valid) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }

    await prisma.member.update({
      where: { id: member.id },
      data: { passwordHash: hashPassword(parsed.data.newPassword) }
    });

    await prisma.refreshToken.updateMany({
      where: {
        memberId: member.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return { status: "ok" };
  });
};
