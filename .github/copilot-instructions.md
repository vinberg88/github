# GitHub Copilot — Project Coding Guidelines

## Stack
- **Frontend**: Next.js 16 (App Router), TypeScript strict, Tailwind CSS, Geist font
- **API**: Fastify 5.x, TypeScript strict, Vitest for tests
- **Database**: PostgreSQL via Prisma 7 with `@prisma/adapter-pg` (Pool-based connection)
- **Validation**: zod 4.x schemas in API routes
- **Auth**: `@fastify/jwt` 10.x — JWT tokens; see `apps/api/src/lib/security.ts` for guards

## General Rules
- TypeScript strict mode is enforced — **never use `any`**; use `unknown` with type narrowing instead
- No `console.log` in production code — use the Fastify request logger (`req.log.info(...)`)
- Validate all external input at system boundaries with **zod schemas**
- Keep functions small and single-purpose; prefer composition over long handlers

## API Patterns (`apps/api/`)
- Each route file exports a `FastifyPluginAsync` and registers itself via `fastify.register()`
- Register all plugins/routes in `src/index.ts`, following the existing pattern
- Use `zod` schemas to validate request body/params/query — do not access `request.body` raw
- Authentication: call `request.jwtVerify()` before any protected handler logic
- Errors: throw typed errors with `createError` from `@fastify/error`, or let Fastify propagate zod validation errors naturally

## Database (Prisma 7)
- Import the singleton `prisma` only from `apps/api/src/lib/db.ts` — never instantiate `PrismaClient` directly
- Connection is adapter-based (`@prisma/adapter-pg`). Pool + adapter are initialized once in `db.ts`.
- **Never** add `url = env("DATABASE_URL")` to `schema.prisma` — the URL is managed by `prisma.config.ts` and the pg adapter at runtime
- Migrations: `npm run prisma:migrate` — always commit generated migration files
- After schema changes: run `npm run prisma:generate` before testing

## Frontend Patterns (`src/`)
- Default to React Server Components; only add `"use client"` when state, effects, or browser APIs are needed
- UI components live in `src/app/components/`; keep them small and composable
- Theme: light/dark is handled by `next-themes` — follow the pattern in `theme-toggle.tsx`
- No inline styles; use Tailwind utility classes

## Testing
- Unit and smoke tests in `apps/api/tests/`; use Vitest (`import { describe, it, expect } from "vitest"`)
- Integration tests skip gracefully when no DB is available — maintain that pattern
- Coverage thresholds: 30 % minimum (lines / functions / branches / statements)
- Run coverage locally: `npm run test:coverage --workspace @app/api`

## Commit & PR Conventions
- Commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`
- Valid types: `feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert | deps | deps-api`
- PR titles are validated against `prTitlePattern` in `.github/policy-matrix.json`
- Branch names validated against `branchNamePattern` in the same file
- All user-facing changes need a `changelog:required` or `changelog:skip` label

## Security
- Never commit secrets — Gitleaks scans every push and PR
- Rate limiting and CORS configured in Fastify via `@fastify/rate-limit` / `@fastify/cors`
- SQL injection prevention: always use Prisma parameterised queries — no raw SQL string interpolation
- JWT secret loaded from `JWT_SECRET` env variable; never hard-code tokens
