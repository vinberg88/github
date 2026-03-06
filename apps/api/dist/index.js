// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";

// src/routes/health.ts
var healthRoutes = async (app2) => {
  app2.get("/health", async () => ({
    status: "ok",
    service: "api",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }));
};

// src/routes/projects.ts
import { z } from "zod";
import { Prisma as Prisma2 } from "@prisma/client";

// src/lib/db.ts
import { PrismaClient } from "@prisma/client";
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/lib/events.ts
import { Prisma } from "@prisma/client";
async function logEvent(input) {
  try {
    const payload = input.payload === void 0 ? void 0 : input.payload === null ? Prisma.JsonNull : input.payload;
    await prisma.event.create({
      data: {
        type: input.type,
        payload,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null
      }
    });
  } catch {
  }
}

// src/routes/projects.ts
var createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2e3).optional(),
  status: z.enum(["planning", "active", "blocked", "completed", "archived"]).default("planning"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  budget: z.number().int().min(1).max(1e9).optional(),
  startsAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  organizationId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional()
});
var updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2e3).nullable().optional(),
  status: z.enum(["planning", "active", "blocked", "completed", "archived"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  budget: z.number().int().min(1).max(1e9).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  organizationId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});
var listProjectsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["planning", "active", "blocked", "completed", "archived"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  organizationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});
var projectParamsSchema = z.object({
  id: z.string().min(1)
});
function invalidPayload(reply, issues) {
  return reply.code(400).send({
    message: "Invalid payload",
    issues
  });
}
var projectRoutes = async (app2) => {
  app2.get("/projects", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsedQuery = listProjectsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return invalidPayload(reply, parsedQuery.error.issues);
    }
    const { q, status, priority, limit } = parsedQuery.data;
    const organizationId = request.user.organizationId;
    const items = await prisma.project.findMany({
      where: q ? {
        status,
        priority,
        organizationId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } }
        ]
      } : {
        status,
        priority,
        organizationId
      },
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            tasks: true,
            events: true
          }
        }
      },
      take: limit
    });
    return {
      count: items.length,
      items
    };
  });
  app2.post("/projects", { preHandler: app2.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }
    const created = await prisma.project.create({
      data: {
        ...parsed.data,
        organizationId: request.user.organizationId,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : void 0,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : void 0
      }
    });
    await logEvent({
      type: "project_created",
      projectId: created.id,
      organizationId: created.organizationId,
      payload: {
        projectId: created.id,
        name: created.name,
        status: created.status,
        priority: created.priority
      }
    });
    return reply.code(201).send(created);
  });
  app2.get("/projects/:id", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }
    const project = await prisma.project.findFirst({
      where: { id: parsedParams.data.id, organizationId: request.user.organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        tasks: {
          orderBy: { updatedAt: "desc" },
          take: 30
        },
        _count: {
          select: {
            tasks: true,
            events: true
          }
        }
      }
    });
    if (!project) {
      return reply.code(404).send({
        message: "Project not found"
      });
    }
    return project;
  });
  app2.patch("/projects/:id", { preHandler: app2.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }
    const parsedBody = updateProjectSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload(reply, parsedBody.error.issues);
    }
    const { startsAt, dueAt, tags, ...rest } = parsedBody.data;
    const updateData = {
      ...rest,
      tags: tags === void 0 ? void 0 : tags === null ? Prisma2.JsonNull : tags,
      startsAt: startsAt === void 0 ? void 0 : startsAt === null ? null : new Date(startsAt),
      dueAt: dueAt === void 0 ? void 0 : dueAt === null ? null : new Date(dueAt)
    };
    const updated = await prisma.project.updateMany({
      where: {
        id: parsedParams.data.id,
        organizationId: request.user.organizationId
      },
      data: updateData
    });
    if (updated.count === 0) {
      return reply.code(404).send({
        message: "Project not found"
      });
    }
    const project = await prisma.project.findFirst({
      where: {
        id: parsedParams.data.id,
        organizationId: request.user.organizationId
      }
    });
    if (project) {
      await logEvent({
        type: "project_updated",
        projectId: project.id,
        organizationId: project.organizationId,
        payload: {
          projectId: project.id,
          status: project.status,
          priority: project.priority
        }
      });
    }
    return project;
  });
  app2.delete("/projects/:id", { preHandler: app2.requireRole(["owner", "admin"]) }, async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }
    const existing = await prisma.project.findFirst({
      where: { id: parsedParams.data.id, organizationId: request.user.organizationId },
      select: { id: true, organizationId: true, name: true }
    });
    if (!existing) {
      return reply.code(404).send({
        message: "Project not found"
      });
    }
    const deleted = await prisma.project.deleteMany({
      where: {
        id: parsedParams.data.id,
        organizationId: request.user.organizationId
      }
    });
    if (deleted.count > 0) {
      await logEvent({
        type: "project_deleted",
        projectId: existing.id,
        organizationId: existing.organizationId,
        payload: {
          projectId: existing.id,
          name: existing.name
        }
      });
    }
    return reply.code(204).send();
  });
};

// src/routes/organizations.ts
import { z as z2 } from "zod";
var createOrganizationSchema = z2.object({
  name: z2.string().min(2).max(120),
  slug: z2.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
  industry: z2.string().max(100).optional(),
  size: z2.number().int().min(1).max(1e6).optional()
});
var createMemberSchema = z2.object({
  email: z2.string().email(),
  fullName: z2.string().min(2).max(120),
  role: z2.enum(["owner", "admin", "manager", "contributor", "viewer"]).default("contributor")
});
var orgParamsSchema = z2.object({
  id: z2.string().min(1)
});
function invalidPayload2(reply, issues) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}
var organizationRoutes = async (app2) => {
  app2.get("/organizations", { preHandler: app2.authenticate }, async (request) => {
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
  app2.post("/organizations", { preHandler: app2.requireRole(["owner", "admin"]) }, async (request, reply) => {
    const parsed = createOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload2(reply, parsed.error.issues);
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
  app2.get("/organizations/:id", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = orgParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return invalidPayload2(reply, parsed.error.issues);
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
  app2.post("/organizations/:id/members", { preHandler: app2.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsedParams = orgParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload2(reply, parsedParams.error.issues);
    }
    if (parsedParams.data.id !== request.user.organizationId) {
      return reply.code(404).send({ message: "Organization not found" });
    }
    const parsedBody = createMemberSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload2(reply, parsedBody.error.issues);
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

// src/routes/tasks.ts
import { z as z3 } from "zod";
var createTaskSchema = z3.object({
  title: z3.string().min(2).max(160),
  description: z3.string().max(2e3).optional(),
  status: z3.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).default("todo"),
  priority: z3.enum(["low", "medium", "high", "urgent"]).default("medium"),
  estimateHours: z3.number().int().min(1).max(1e4).optional(),
  dueAt: z3.string().datetime().optional(),
  projectId: z3.string().min(1),
  assigneeId: z3.string().min(1).optional()
});
var updateTaskSchema = z3.object({
  title: z3.string().min(2).max(160).optional(),
  description: z3.string().max(2e3).nullable().optional(),
  status: z3.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
  priority: z3.enum(["low", "medium", "high", "urgent"]).optional(),
  estimateHours: z3.number().int().min(1).max(1e4).nullable().optional(),
  dueAt: z3.string().datetime().nullable().optional(),
  assigneeId: z3.string().min(1).nullable().optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});
var taskParamsSchema = z3.object({
  id: z3.string().min(1)
});
var listTaskQuerySchema = z3.object({
  projectId: z3.string().min(1).optional(),
  assigneeId: z3.string().min(1).optional(),
  status: z3.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
  priority: z3.enum(["low", "medium", "high", "urgent"]).optional(),
  limit: z3.coerce.number().int().min(1).max(200).default(100)
});
function invalidPayload3(reply, issues) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}
var taskRoutes = async (app2) => {
  app2.get("/tasks", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = listTaskQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return invalidPayload3(reply, parsed.error.issues);
    }
    const { projectId, assigneeId, status, priority, limit } = parsed.data;
    const items = await prisma.task.findMany({
      where: {
        project: {
          organizationId: request.user.organizationId
        },
        projectId,
        assigneeId,
        status,
        priority
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        project: {
          select: { id: true, name: true, status: true }
        },
        assignee: {
          select: { id: true, fullName: true, email: true }
        }
      },
      take: limit
    });
    return {
      count: items.length,
      items
    };
  });
  app2.post("/tasks", { preHandler: app2.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload3(reply, parsed.error.issues);
    }
    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : void 0;
    const project = await prisma.project.findFirst({
      where: {
        id: parsed.data.projectId,
        organizationId: request.user.organizationId
      },
      select: {
        id: true,
        organizationId: true
      }
    });
    if (!project) {
      return reply.code(404).send({ message: "Project not found" });
    }
    if (parsed.data.assigneeId) {
      const assignee = await prisma.member.findFirst({
        where: {
          id: parsed.data.assigneeId,
          organizationId: request.user.organizationId,
          isActive: true
        },
        select: { id: true }
      });
      if (!assignee) {
        return reply.code(404).send({ message: "Assignee not found" });
      }
    }
    const created = await prisma.task.create({
      data: {
        ...parsed.data,
        dueAt
      }
    });
    await logEvent({
      type: "task_created",
      projectId: created.projectId,
      payload: {
        taskId: created.id,
        title: created.title,
        status: created.status,
        priority: created.priority
      }
    });
    return reply.code(201).send(created);
  });
  app2.patch("/tasks/:id", { preHandler: app2.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsedParams = taskParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload3(reply, parsedParams.error.issues);
    }
    const parsedBody = updateTaskSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload3(reply, parsedBody.error.issues);
    }
    const nextStatus = parsedBody.data.status;
    const existingTask = await prisma.task.findFirst({
      where: {
        id: parsedParams.data.id,
        project: {
          organizationId: request.user.organizationId
        }
      },
      select: {
        id: true,
        projectId: true
      }
    });
    if (!existingTask) {
      return reply.code(404).send({ message: "Task not found" });
    }
    if (parsedBody.data.assigneeId) {
      const assignee = await prisma.member.findFirst({
        where: {
          id: parsedBody.data.assigneeId,
          organizationId: request.user.organizationId,
          isActive: true
        },
        select: { id: true }
      });
      if (!assignee) {
        return reply.code(404).send({ message: "Assignee not found" });
      }
    }
    const data = {
      ...parsedBody.data,
      dueAt: parsedBody.data.dueAt === void 0 ? void 0 : parsedBody.data.dueAt === null ? null : new Date(parsedBody.data.dueAt),
      completedAt: nextStatus === void 0 ? void 0 : nextStatus === "done" ? /* @__PURE__ */ new Date() : null
    };
    const updated = await prisma.task.updateMany({
      where: { id: existingTask.id },
      data
    });
    if (updated.count === 0) {
      return reply.code(404).send({ message: "Task not found" });
    }
    const task = await prisma.task.findUnique({
      where: { id: existingTask.id }
    });
    if (task) {
      await logEvent({
        type: "task_updated",
        projectId: task.projectId,
        payload: { taskId: task.id, status: task.status, priority: task.priority }
      });
    }
    return task;
  });
};

// src/routes/analytics.ts
var analyticsRoutes = async (app2) => {
  app2.get("/analytics/overview", { preHandler: app2.authenticate }, async (request) => {
    const organizationId = request.user.organizationId;
    const [
      totalMembers,
      totalProjects,
      totalTasks,
      totalEvents,
      projectsByStatus,
      tasksByStatus,
      tasksByPriority
    ] = await Promise.all([
      prisma.member.count({ where: { organizationId } }),
      prisma.project.count({ where: { organizationId } }),
      prisma.task.count({
        where: {
          project: {
            organizationId
          }
        }
      }),
      prisma.event.count({
        where: {
          OR: [{ organizationId }, { project: { organizationId } }]
        }
      }),
      prisma.project.groupBy({
        where: { organizationId },
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.task.groupBy({
        where: {
          project: {
            organizationId
          }
        },
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.task.groupBy({
        where: {
          project: {
            organizationId
          }
        },
        by: ["priority"],
        _count: { _all: true }
      })
    ]);
    return {
      totals: {
        organizations: 1,
        members: totalMembers,
        projects: totalProjects,
        tasks: totalTasks,
        events: totalEvents
      },
      projectsByStatus: projectsByStatus.map((x) => ({ status: x.status, count: x._count._all })),
      tasksByStatus: tasksByStatus.map((x) => ({ status: x.status, count: x._count._all })),
      tasksByPriority: tasksByPriority.map((x) => ({ priority: x.priority, count: x._count._all }))
    };
  });
};

// src/routes/events.ts
import { z as z4 } from "zod";
var listEventsQuerySchema = z4.object({
  type: z4.enum([
    "project_created",
    "project_updated",
    "project_deleted",
    "task_created",
    "task_updated",
    "organization_created",
    "member_created"
  ]).optional(),
  projectId: z4.string().min(1).optional(),
  organizationId: z4.string().min(1).optional(),
  limit: z4.coerce.number().int().min(1).max(500).default(100)
});
var eventRoutes = async (app2) => {
  app2.get("/events", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = listEventsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid payload",
        issues: parsed.error.issues
      });
    }
    const events = await prisma.event.findMany({
      where: {
        type: parsed.data.type,
        projectId: parsed.data.projectId,
        OR: [
          {
            organizationId: request.user.organizationId
          },
          {
            project: {
              organizationId: request.user.organizationId
            }
          }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit
    });
    return {
      count: events.length,
      items: events
    };
  });
};

// src/plugins/security.ts
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
var securityPlugin = async (app2) => {
  await app2.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-change-this-secret"
  });
  await app2.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute"
  });
  app2.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  });
  app2.decorate("requireRole", (roles) => {
    return async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      if (!request.user || !roles.includes(request.user.role)) {
        return reply.code(403).send({ message: "Forbidden" });
      }
    };
  });
};
var security_default = fp(securityPlugin, {
  name: "security-plugin"
});

// src/routes/auth.ts
import { z as z5 } from "zod";

// src/lib/security.ts
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
var KEYLEN = 64;
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, passwordHash) {
  const [salt, originalHash] = passwordHash.split(":");
  if (!salt || !originalHash) {
    return false;
  }
  const currentHash = scryptSync(password, salt, KEYLEN);
  const original = Buffer.from(originalHash, "hex");
  if (original.length !== currentHash.length) {
    return false;
  }
  return timingSafeEqual(original, currentHash);
}
function generateOpaqueToken(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}
function hashOpaqueToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// src/routes/auth.ts
var registerSchema = z5.object({
  email: z5.string().email(),
  fullName: z5.string().min(2).max(120),
  password: z5.string().min(8).max(200),
  role: z5.enum(["owner", "admin", "manager", "contributor", "viewer"]).default("contributor")
});
var loginSchema = z5.object({
  email: z5.string().email(),
  password: z5.string().min(8).max(200)
});
var refreshSchema = z5.object({
  refreshToken: z5.string().min(20).max(500)
});
var logoutSchema = z5.object({
  refreshToken: z5.string().min(20).max(500).optional(),
  allSessions: z5.boolean().optional().default(false)
});
var revokeSessionParamsSchema = z5.object({
  id: z5.string().min(1)
});
var updatePasswordSchema = z5.object({
  currentPassword: z5.string().min(8).max(200),
  newPassword: z5.string().min(8).max(200)
});
var ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
var REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_DAYS ?? 14);
function invalidPayload4(reply, issues) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}
function createRefreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1e3);
}
function getRequestMeta(request) {
  const userAgentValue = request.headers["user-agent"];
  return {
    userAgent: typeof userAgentValue === "string" ? userAgentValue.slice(0, 500) : null,
    ipAddress: request.ip
  };
}
function userView(member) {
  return {
    id: member.id,
    email: member.email,
    fullName: member.fullName,
    role: member.role,
    organizationId: member.organizationId
  };
}
var authRoutes = async (app2) => {
  app2.post("/auth/register", { preHandler: app2.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
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
  app2.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
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
      data: { lastLoginAt: /* @__PURE__ */ new Date() }
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
        lastUsedAt: /* @__PURE__ */ new Date(),
        expiresAt: createRefreshExpiryDate()
      }
    });
    return {
      accessToken,
      refreshToken,
      user: userView(member)
    };
  });
  app2.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
    }
    const now = /* @__PURE__ */ new Date();
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
  app2.post("/auth/logout", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = logoutSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
    }
    if (parsed.data.allSessions) {
      await prisma.refreshToken.updateMany({
        where: {
          memberId: request.user.sub,
          revokedAt: null
        },
        data: {
          revokedAt: /* @__PURE__ */ new Date()
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
        revokedAt: /* @__PURE__ */ new Date()
      }
    });
    return { status: "ok" };
  });
  app2.get("/auth/sessions", { preHandler: app2.authenticate }, async (request) => {
    const now = /* @__PURE__ */ new Date();
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
  app2.delete("/auth/sessions/:id", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = revokeSessionParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
    }
    const updated = await prisma.refreshToken.updateMany({
      where: {
        id: parsed.data.id,
        memberId: request.user.sub,
        organizationId: request.user.organizationId,
        revokedAt: null
      },
      data: {
        revokedAt: /* @__PURE__ */ new Date()
      }
    });
    if (updated.count === 0) {
      return reply.code(404).send({ message: "Session not found" });
    }
    return { status: "ok" };
  });
  app2.get("/auth/me", { preHandler: app2.authenticate }, async (request) => {
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
  app2.post("/auth/change-password", { preHandler: app2.authenticate }, async (request, reply) => {
    const parsed = updatePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload4(reply, parsed.error.issues);
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
        revokedAt: /* @__PURE__ */ new Date()
      }
    });
    return { status: "ok" };
  });
};

// src/routes/admin.ts
var adminRoutes = async (app2) => {
  app2.get("/admin/health/deep", { preHandler: app2.requireRole(["owner", "admin"]) }, async (request) => {
    const organizationId = request.user.organizationId;
    const [db, orgs, members, projects, tasks, events] = await Promise.all([
      prisma.$queryRaw`SELECT 1 as ok`,
      prisma.organization.count({ where: { id: organizationId } }),
      prisma.member.count({ where: { organizationId } }),
      prisma.project.count({ where: { organizationId } }),
      prisma.task.count({
        where: {
          project: {
            organizationId
          }
        }
      }),
      prisma.event.count({
        where: {
          OR: [{ organizationId }, { project: { organizationId } }]
        }
      })
    ]);
    return {
      status: "ok",
      db,
      totals: { orgs, members, projects, tasks, events },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  app2.get("/admin/members", { preHandler: app2.requireRole(["owner", "admin", "manager"]) }, async (request) => {
    return prisma.member.findMany({
      where: {
        organizationId: request.user.organizationId
      },
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        _count: {
          select: {
            tasksAssigned: true
          }
        }
      },
      take: 200
    });
  });
};

// src/index.ts
var app = Fastify({ logger: true });
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"]
});
await app.register(security_default);
await app.register(healthRoutes, { prefix: "/v1" });
await app.register(authRoutes, { prefix: "/v1" });
await app.register(projectRoutes, { prefix: "/v1" });
await app.register(organizationRoutes, { prefix: "/v1" });
await app.register(taskRoutes, { prefix: "/v1" });
await app.register(analyticsRoutes, { prefix: "/v1" });
await app.register(eventRoutes, { prefix: "/v1" });
await app.register(adminRoutes, { prefix: "/v1" });
var port = Number(process.env.API_PORT ?? 4e3);
var host = process.env.API_HOST ?? "0.0.0.0";
try {
  await app.listen({ port, host });
  app.log.info(`API running at http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
