import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

describe("health route", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp({ logger: false, registerDomainRoutes: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns service health payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/health"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body).toMatchObject({
      status: "ok",
      service: "api"
    });
    expect(typeof body.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
