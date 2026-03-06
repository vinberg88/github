import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/db.js";

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/analytics/overview", { preHandler: app.authenticate }, async (request) => {
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
