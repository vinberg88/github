import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { logEvent } from "../lib/events.js";

const createTaskSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  estimateHours: z.number().int().min(1).max(10_000).optional(),
  dueAt: z.string().datetime().optional(),
  projectId: z.string().min(1),
  assigneeId: z.string().min(1).optional()
});

const updateTaskSchema = z
  .object({
    title: z.string().min(2).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    estimateHours: z.number().int().min(1).max(10_000).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  });

const taskParamsSchema = z.object({
  id: z.string().min(1)
});

const listTaskQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

function invalidPayload(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, issues: unknown) {
  return reply.code(400).send({ message: "Invalid payload", issues });
}

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tasks", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = listTaskQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
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

  app.post("/tasks", { preHandler: app.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return invalidPayload(reply, parsed.error.issues);
    }

    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined;

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

  app.patch("/tasks/:id", { preHandler: app.requireRole(["owner", "admin", "manager", "contributor"]) }, async (request, reply) => {
    const parsedParams = taskParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return invalidPayload(reply, parsedParams.error.issues);
    }

    const parsedBody = updateTaskSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return invalidPayload(reply, parsedBody.error.issues);
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
      dueAt:
        parsedBody.data.dueAt === undefined
          ? undefined
          : parsedBody.data.dueAt === null
            ? null
            : new Date(parsedBody.data.dueAt),
      completedAt: nextStatus === undefined ? undefined : nextStatus === "done" ? new Date() : null
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
