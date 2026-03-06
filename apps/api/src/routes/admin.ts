import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/health/deep", { preHandler: app.requireRole(["owner", "admin"]) }, async (request) => {
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
      timestamp: new Date().toISOString()
    };
  });

  app.get("/admin/members", { preHandler: app.requireRole(["owner", "admin", "manager"]) }, async (request) => {
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
