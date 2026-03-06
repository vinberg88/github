import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";

const listEventsQuerySchema = z.object({
  type: z
    .enum([
      "project_created",
      "project_updated",
      "project_deleted",
      "task_created",
      "task_updated",
      "organization_created",
      "member_created"
    ])
    .optional(),
  projectId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", { preHandler: app.authenticate }, async (request, reply) => {
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
