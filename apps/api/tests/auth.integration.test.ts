import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvIfPresent() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const hasSingleQuotes = rawValue.startsWith("'") && rawValue.endsWith("'");
    const hasDoubleQuotes = rawValue.startsWith('"') && rawValue.endsWith('"');
    const value = hasSingleQuotes || hasDoubleQuotes ? rawValue.slice(1, -1) : rawValue;

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvIfPresent();

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const HAS_DATABASE_URL = Boolean(process.env.DATABASE_URL);
const HAS_TEST_PASSWORD = Boolean(process.env.TEST_OWNER_PASSWORD);
const describeDb = RUN_DB_TESTS && HAS_DATABASE_URL && HAS_TEST_PASSWORD ? describe : describe.skip;

const TEST_ORG_SLUG = "acme-platform";
const TEST_EMAIL = "owner@acme.local";
const TEST_PASSWORD = process.env.TEST_OWNER_PASSWORD ?? "";

describeDb("auth integration (db)", () => {
  let app: FastifyInstance;
  let prisma: import("@prisma/client").PrismaClient;
  let createApp: typeof import("../src/app.js").createApp;
  let hashOpaqueToken: typeof import("../src/lib/security.js").hashOpaqueToken;
  let hashPassword: typeof import("../src/lib/security.js").hashPassword;

  beforeAll(async () => {
    const appModule = await import("../src/app.js");
    const dbModule = await import("../src/lib/db.js");
    const securityModule = await import("../src/lib/security.js");

    createApp = appModule.createApp;
    prisma = dbModule.prisma;
    hashOpaqueToken = securityModule.hashOpaqueToken;
    hashPassword = securityModule.hashPassword;

    app = await createApp({ logger: false });

    const org = await prisma.organization.upsert({
      where: { slug: TEST_ORG_SLUG },
      update: {
        name: "Acme Platform",
        industry: "SaaS",
        size: 420
      },
      create: {
        name: "Acme Platform",
        slug: TEST_ORG_SLUG,
        industry: "SaaS",
        size: 420
      }
    });

    await prisma.member.upsert({
      where: { email: TEST_EMAIL },
      update: {
        fullName: "Acme Owner",
        role: "owner",
        organizationId: org.id,
        isActive: true,
        passwordHash: hashPassword(TEST_PASSWORD)
      },
      create: {
        email: TEST_EMAIL,
        fullName: "Acme Owner",
        role: "owner",
        organizationId: org.id,
        isActive: true,
        passwordHash: hashPassword(TEST_PASSWORD)
      }
    });
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        member: {
          email: TEST_EMAIL
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        member: {
          email: TEST_EMAIL
        }
      }
    });

    await app.close();
    await prisma.$disconnect();
  });

  it("supports login -> refresh rotation -> sessions -> logout", async () => {
    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginBody = loginResponse.json();

    expect(loginBody).toMatchObject({
      user: {
        email: TEST_EMAIL
      }
    });
    expect(typeof loginBody.accessToken).toBe("string");
    expect(typeof loginBody.refreshToken).toBe("string");
    expect(loginBody.accessToken.length).toBeGreaterThan(20);
    expect(loginBody.refreshToken.length).toBeGreaterThan(20);

    const firstRefreshToken = loginBody.refreshToken;

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: {
        refreshToken: firstRefreshToken
      }
    });

    expect(refreshResponse.statusCode).toBe(200);

    const refreshBody = refreshResponse.json();

    expect(typeof refreshBody.accessToken).toBe("string");
    expect(typeof refreshBody.refreshToken).toBe("string");
    expect(refreshBody.accessToken.length).toBeGreaterThan(20);
    expect(refreshBody.refreshToken).not.toBe(firstRefreshToken);

    const revokedFirstToken = await prisma.refreshToken.findUnique({
      where: {
        tokenHash: hashOpaqueToken(firstRefreshToken)
      },
      select: {
        revokedAt: true
      }
    });

    expect(revokedFirstToken?.revokedAt).not.toBeNull();

    const sessionsResponse = await app.inject({
      method: "GET",
      url: "/v1/auth/sessions",
      headers: {
        authorization: `Bearer ${refreshBody.accessToken}`
      }
    });

    expect(sessionsResponse.statusCode).toBe(200);

    const sessionsBody = sessionsResponse.json();

    expect(typeof sessionsBody.count).toBe("number");
    expect(Array.isArray(sessionsBody.items)).toBe(true);
    expect(sessionsBody.count).toBeGreaterThanOrEqual(1);
    expect(sessionsBody.items.length).toBeGreaterThanOrEqual(1);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        authorization: `Bearer ${refreshBody.accessToken}`
      },
      payload: {
        allSessions: true
      }
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json()).toMatchObject({ status: "ok" });

    const secondRefreshAttempt = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: {
        refreshToken: refreshBody.refreshToken
      }
    });

    expect(secondRefreshAttempt.statusCode).toBe(401);
  });
});
