import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { projectRoutes } from "./routes/projects.js";
import { organizationRoutes } from "./routes/organizations.js";
import { taskRoutes } from "./routes/tasks.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { eventRoutes } from "./routes/events.js";
import securityPlugin from "./plugins/security.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"]
});
await app.register(securityPlugin);

await app.register(healthRoutes, { prefix: "/v1" });
await app.register(authRoutes, { prefix: "/v1" });
await app.register(projectRoutes, { prefix: "/v1" });
await app.register(organizationRoutes, { prefix: "/v1" });
await app.register(taskRoutes, { prefix: "/v1" });
await app.register(analyticsRoutes, { prefix: "/v1" });
await app.register(eventRoutes, { prefix: "/v1" });
await app.register(adminRoutes, { prefix: "/v1" });

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`API running at http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
