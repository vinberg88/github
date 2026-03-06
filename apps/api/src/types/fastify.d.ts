import "fastify";
import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
      role: "owner" | "admin" | "manager" | "contributor" | "viewer";
      organizationId: string;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").preHandlerHookHandler;
    requireRole: (
      roles: Array<"owner" | "admin" | "manager" | "contributor" | "viewer">
    ) => import("fastify").preHandlerHookHandler;
  }
}
