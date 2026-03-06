import { Prisma, type EventType } from "@prisma/client";
import { prisma } from "./db.js";

type LogEventInput = {
  type: EventType;
  payload?: unknown;
  organizationId?: string | null;
  projectId?: string | null;
};

export async function logEvent(input: LogEventInput) {
  try {
    const payload =
      input.payload === undefined
        ? undefined
        : input.payload === null
          ? Prisma.JsonNull
          : (input.payload as Prisma.InputJsonValue);

    await prisma.event.create({
      data: {
        type: input.type,
        payload,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null
      }
    });
  } catch {
    // Never block the primary flow because of event logging failures.
  }
}
