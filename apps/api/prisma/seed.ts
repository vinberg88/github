import { PrismaClient, ProjectPriority, ProjectStatus, TaskPriority, TaskStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/security.js";

const prisma = new PrismaClient();

async function seed() {
  const org = await prisma.organization.upsert({
    where: { slug: "acme-platform" },
    update: {
      name: "Acme Platform",
      industry: "SaaS",
      size: 420
    },
    create: {
      name: "Acme Platform",
      slug: "acme-platform",
      industry: "SaaS",
      size: 420
    }
  });

  const owner = await prisma.member.upsert({
    where: { email: "owner@acme.local" },
    update: {
      fullName: "Acme Owner",
      role: "owner",
      isActive: true,
      passwordHash: hashPassword("ChangeMe123!")
    },
    create: {
      email: "owner@acme.local",
      fullName: "Acme Owner",
      role: "owner",
      organizationId: org.id,
      passwordHash: hashPassword("ChangeMe123!")
    }
  });

  const manager = await prisma.member.upsert({
    where: { email: "manager@acme.local" },
    update: {
      fullName: "Acme Manager",
      role: "manager",
      isActive: true,
      passwordHash: hashPassword("ChangeMe123!")
    },
    create: {
      email: "manager@acme.local",
      fullName: "Acme Manager",
      role: "manager",
      organizationId: org.id,
      passwordHash: hashPassword("ChangeMe123!")
    }
  });

  const project = await prisma.project.upsert({
    where: { id: "seed-growth-workspace" },
    update: {
      name: "Growth Workspace",
      description: "Sales and delivery cockpit",
      status: ProjectStatus.active,
      priority: ProjectPriority.high,
      budget: 500000,
      organizationId: org.id,
      tags: ["growth", "b2b", "revenue"]
    },
    create: {
      id: "seed-growth-workspace",
      name: "Growth Workspace",
      description: "Sales and delivery cockpit",
      status: ProjectStatus.active,
      priority: ProjectPriority.high,
      budget: 500000,
      organizationId: org.id,
      startsAt: new Date(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      tags: ["growth", "b2b", "revenue"]
    }
  });

  await prisma.task.upsert({
    where: { id: "seed-kpi-task" },
    update: {
      title: "Ship KPI dashboard",
      status: TaskStatus.in_progress,
      priority: TaskPriority.high,
      projectId: project.id,
      assigneeId: manager.id
    },
    create: {
      id: "seed-kpi-task",
      title: "Ship KPI dashboard",
      description: "Wire analytics endpoint into UI",
      status: TaskStatus.in_progress,
      priority: TaskPriority.high,
      estimateHours: 24,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      projectId: project.id,
      assigneeId: manager.id
    }
  });

  await prisma.event.create({
    data: {
      type: "project_created",
      organizationId: org.id,
      projectId: project.id,
      payload: {
        source: "seed",
        message: "Initial demo dataset provisioned"
      }
    }
  });

  console.log("Seed completed.");
  console.log(`Owner login: ${owner.email} / ChangeMe123!`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
