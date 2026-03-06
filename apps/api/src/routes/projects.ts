import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { logEvent } from "../lib/events.js";

const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  status: z.enum(["planning", "active", "blocked", "completed", "archived"]).default("planning"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  budget: z.number().int().min(1).max(1_000_000_000).optional(),
  startsAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  organizationId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional()
});

const updateProjectSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["planning", "active", "blocked", "completed", "archived"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    budget: z.number().int().min(1).max(1_000_000_000).nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    organizationId: z.string().min(1).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

const listProjectsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["planning", "active", "blocked", "completed", "archived"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  organizationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
});

const projectParamsSchema = z.object({
  id: z.string().min(1)
});

function invalidPayload(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, issues: unknown) {
  return reply.code(400).send({
    message: "Invalid payload",
    issues
  });
}

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects", { preHandler: app.authenticate }, async (request, reply) => {
    const parsedQuery = listProjectsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return invalidPayload(reply, parsedQuery.error.issues);
    }

    const { q, status, priority, limit } = parsedQuery.data;
    const organizationId = request.user.organizationId;

    const items = await prisma.project.findMany({
      where: q
        ? {
            status,
            priority,
            organizationId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } }
            ]
          }
        : {
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

  app.post("/projects", { preHandler: app.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);

    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const created = await prisma.project.create({
      data: {
        ...parsed.data,
        organizationId: request.user.organizationId,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined
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

  app.get("/projects/:id", { preHandler: app.authenticate }, async (request, reply) => {
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

  app.patch("/projects/:id", { preHandler: app.requireRole(["owner", "admin", "manager"]) }, async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }

    const parsedBody = updateProjectSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload(reply, parsedBody.error.issues);
    }

    const { startsAt, dueAt, tags, ...rest } = parsedBody.data;

    const updateData: Prisma.ProjectUpdateInput = {
      ...rest,
      tags:
        tags === undefined
          ? undefined
          : tags === null
            ? Prisma.JsonNull
            : (tags as Prisma.InputJsonValue),
      startsAt: startsAt === undefined ? undefined : startsAt === null ? null : new Date(startsAt),
      dueAt: dueAt === undefined ? undefined : dueAt === null ? null : new Date(dueAt)
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

  app.delete("/projects/:id", { preHandler: app.requireRole(["owner", "admin"]) }, async (request, reply) => {
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
