import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

describe("auth smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access to /auth/me", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ message: "Unauthorized" });
  });

  it("returns 400 for invalid /auth/login payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "not-an-email",
        password: "short"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "Invalid payload" });
  });
});
