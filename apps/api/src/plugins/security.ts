import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";

const securityPlugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-change-this-secret"
  });

  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute"
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: "Unauthorized" });
    }
  });

  app.decorate("requireRole", (roles) => {
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

export default fp(securityPlugin, {
  name: "security-plugin"
});
