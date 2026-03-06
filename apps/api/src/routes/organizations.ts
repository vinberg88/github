import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { logEvent } from "../lib/events.js";

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  industry: z.string().max(100).optional(),
  size: z.number().int().min(1).max(1_000_000).optional()
});

const createMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum(["owner", "admin", "manager", "contributor", "viewer"]).default("contributor")
});

const orgParamsSchema = z.object({
  id: z.string().min(1)
});

function invalidPayload(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, issues: unknown) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/organizations", { preHandler: app.authenticate }, async (request) => {
    const org = await prisma.organization.findFirst({
      where: {
        id: request.user.organizationId
      },
      include: {
        _count: {
          select: {
            projects: true,
            members: true
          }
        }
      }
    });

    return org ? [org] : [];
  });

  app.post("/organizations", { preHandler: app.requireRole(["owner", "admin"]) }, async (request, reply) => {
    const parsed = createOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const created = await prisma.organization.create({
      data: parsed.data
    });

    await logEvent({
      type: "organization_created",
      organizationId: created.id,
      payload: { organizationId: created.id, name: created.name }
    });

    return reply.code(201).send(created);
  });

  app.get("/organizations/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = orgParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    if (parsed.data.id !== request.user.organizationId) {
      return reply.code(404).send({ message: "Organization not found" });
    }

    const org = await prisma.organization.findUnique({
      where: { id: parsed.data.id },
      include: {
        projects: {
          orderBy: { updatedAt: "desc" },
          take: 20
        },
        members: {
          orderBy: { createdAt: "desc" },
          take: 50
        },
        _count: {
          select: {
            projects: true,
            members: true
          }
        }
      }
    });

    if (!org) {
      return reply.code(404).send({ message: "Organization not found" });
    }

    return org;
  });

  app.post("/organizations/:id/members", { preHandler: app.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsedParams = orgParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }

    if (parsedParams.data.id !== request.user.organizationId) {
      return reply.code(404).send({ message: "Organization not found" });
    }

    const parsedBody = createMemberSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload(reply, parsedBody.error.issues);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true }
    });

    if (!organization) {
      return reply.code(404).send({ message: "Organization not found" });
    }

    const member = await prisma.member.create({
      data: {
        ...parsedBody.data,
        organizationId: organization.id
      }
    });

    await logEvent({
      type: "member_created",
      organizationId: organization.id,
      payload: { memberId: member.id, email: member.email }
    });

    return reply.code(201).send(member);
  });
};
