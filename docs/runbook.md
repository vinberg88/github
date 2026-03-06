# Drift- och release-runbook

## Lokal verifiering före PR

- `npm install`
- `npm run prisma:generate`
- `npm run lint`
- `npm run build`
- Verifiera att commit hooks fungerar (pre-commit + commit-msg)

## Staging deploy

1. Kör workflow: `Deploy to Azure (Staging)`
2. Vänta på environment approval (required reviewers)
3. Verifiera health endpoint och grundflöden (`/auth-lab`, API health)

## Production deploy

1. Kör workflow: `Deploy to Azure (Production)` manuellt
2. Säkerställ approvals i `production`-environment
3. Verifiera smoke test efter deploy

## Incident-snabbguide

1. Bekräfta scope (web, api, infra)
2. Kontrollera senaste merge/release
3. Kontrollera CI och deploy-loggar
4. Rulla tillbaka vid behov
5. Dokumentera root cause i issue/postmortem

## Databas/Prisma

- Prisma config: `apps/api/prisma.config.ts`
- Seed: `npm run prisma:seed`
- Vid schemaändring: inkludera migration och verifiera seed-kompatibilitet
