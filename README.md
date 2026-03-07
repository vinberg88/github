# Azure + GitHub storskalig app

Detta repo innehåller en produktionsinriktad grund för en större app som körs via Azure och GitHub.

Här är en praktisk och modern översikt över hur du bygger och distribuerar appar till Azure med GitHub 
som huvudsaklig källa och verktyg. Det finns idag flera väldigt smidiga sätt att göra detta – valet
beror på vilken typ av app du bygger. 

Azure DevOps och GitHub integreras väldigt bra idag särskilt om du vill behålla Azure Boards planering,
backlog, sprintar) och/eller Azure Pipelines (CI/CD) medan koden bor på GitHub. Microsoft satsar hårt på
hybrid-scenariot: GitHub som primär repo-plattform (med Copilot, Actions, etc.) + Azure DevOps som
styrning och orkestrering.

----

![github2](https://github.com/user-attachments/assets/510c7583-bdc8-4a45-ba86-2b644b5750a5)

----


## Arkitektur

- **Frontend:** Next.js 16 (TypeScript, App Router, Tailwind)
- **Backend:** Fastify API (TypeScript)
- **Databas:** PostgreSQL + Prisma
- **Cache:** Redis
- **IaC:** Bicep (`infra/main.bicep`)
- **Hosting:** Azure Container Apps
- **CI/CD:** GitHub Actions

### Domänmoduler (utökad plattform)

- **Organizations**: multi-tenant organisationslager
- **Members**: medlemskatalog per organisation
- **Projects**: portfölj med status, prioritet, budget, tags och tidslinje
- **Tasks**: arbetsobjekt med assignee, statusflöde och prioritering
- **Events**: audit/event stream för viktig aktivitet
- **Analytics**: sammanställda KPI:er och statusfördelning

## Projektstruktur

- `src/` — Next.js-webapp
- `apps/api/` — Fastify API + Prisma
- `infra/` — Azure-infrastruktur (Bicep)
- `.github/workflows/` — CI/CD pipelines
- `.github/policy-matrix.json` — central policykälla för governance-regler
- `azure.yaml` — Azure Developer CLI-konfiguration

Prisma-konfiguration för API:t ligger i `apps/api/prisma.config.ts` (seed körs via `npm run prisma:seed` i `apps/api/package.json`).

## Lokal utveckling

1. Kopiera variabler från `.env.example` till `.env` (placeholder finns redan).
2. Installera beroenden och generera Prisma-klient.
3. Kör webb + API samtidigt.

Körning:

- `npm install`
- `npm run prisma:generate`
- `npm run prisma:seed`
- `npm run dev`

Frontend: `http://localhost:3000`
API: `http://localhost:4000/v1/health`

### Snabb test av frontend + backend

1. Starta hela stacken med `npm run dev`.
2. Öppna `http://localhost:3000/auth-lab`.
3. Logga in med seed-användare: `owner@acme.local / ChangeMe123!`.
4. Testa flöden:
   - `Login` → får `accessToken` + `refreshToken`
   - `Refresh Token` → nytt token-par
   - `GET /auth/sessions` → lista aktiva sessioner (IP/UA/expiry)
   - `DELETE /auth/sessions/:id` → revoke en specifik session
   - `GET /auth/me` → verifiera aktiv session
   - `GET /projects (scoped)` → verifiera role-scoped organization isolation
   - `Logout` (single/all sessions) → refresh token revokas

## API (projekt)

Bas-URL: `http://localhost:4000/v1`

- `GET /projects?limit=50&q=<söktext>` — lista projekt med valfri fritextsökning
- `POST /projects` — skapa projekt
- `GET /projects/:id` — hämta ett projekt
- `PATCH /projects/:id` — uppdatera namn/beskrivning
- `DELETE /projects/:id` — ta bort projekt

## API (övriga moduler)

- `GET /organizations` — lista organisationer med projekt/medlems-count
- `POST /organizations` — skapa organisation
- `GET /organizations/:id` — detaljer + senaste projekt + medlemmar
- `POST /organizations/:id/members` — skapa medlem i organisation
- `GET /tasks` — lista tasks med filter (`projectId`, `assigneeId`, `status`, `priority`, `limit`)
- `POST /tasks` — skapa task
- `PATCH /tasks/:id` — uppdatera task
- `GET /events` — senaste händelser (event stream)
- `GET /analytics/overview` — KPI:er och statusfördelning

## API (auth + admin)

- `POST /auth/register` — registrera medlem i **din egen organisation** (owner/admin/manager)
- `POST /auth/login` — logga in och få `accessToken` + `refreshToken`
- `POST /auth/refresh` — rotera refresh token och få nytt token-par
- `POST /auth/logout` — revoke refresh token (eller alla sessioner)
- `GET /auth/sessions` — lista aktiva refresh-sessioner för inloggad användare
- `DELETE /auth/sessions/:id` — revoke en specifik refresh-session
- `GET /auth/me` — hämta inloggad användare (kräver Bearer-token)
- `POST /auth/change-password` — byt lösenord (kräver Bearer-token)
- `GET /admin/health/deep` — djup health + totals (owner/admin)
- `GET /admin/members` — medlemslista med relationer (owner/admin/manager)

Alla datamoduler är nu org-isolerade: en användare ser och uppdaterar endast resurser i sin egen organisation.

Refresh-flödet har även reuse-detection: om ett revokat/utgånget refresh token återanvänds revokas alla aktiva sessioner för den användaren.

Skrivskyddade endpoints använder RBAC:

- **owner/admin**: organisationsskapande, projektradering, admin-endpoints
- **owner/admin/manager**: medlemsskapande, projektuppdatering
- **owner/admin/manager/contributor**: projekt/task create och task update

Exempel payload för create/update:

- `name` (2-120 tecken)
- `description` (valfri, max 2000 tecken)

## Build & kvalitet

- `npm run lint`
- `npm run build`

## Miljövariabler (säkerhet)

- `JWT_SECRET` — signeringsnyckel för API-token
- `JWT_ACCESS_EXPIRES_IN` — livslängd access token (t.ex. `15m`)
- `JWT_REFRESH_DAYS` — livslängd refresh token i dagar
- `RATE_LIMIT_MAX` — antal requests per fönster
- `RATE_LIMIT_WINDOW` — tidsfönster (t.ex. `1 minute`)

> Demo-seed skapar även en ägare: `owner@acme.local / ChangeMe123!`.
> Byt lösenord direkt i riktiga miljöer.

## Azure deployment (azd)

Förutsättningar:

- Azure-konto
- Azure Developer CLI (azd)
- Inloggad Azure-session

Standardflöde:

- `azd auth login`
- `azd env new <env-name>`
- `azd up`

## GitHub Actions

- `ci.yml`: lint + build på PR och push till `main`
- `deploy-azure.yml`: **manuell** production-deploy till Azure via `azd`
- `deploy-azure-staging.yml`: staging-wrapper för Azure deploy (environment `staging`)
- `preview-vercel.yml`: preview deploy för PR (om Vercel-secrets finns)
- `release.yml`: automatisk version + changelog via Release Please
- `dependabot-auto-merge.yml`: auto-approve + auto-merge för Dependabot patch/minor updates
- `codeql.yml`: säkerhetsanalys (CodeQL) på PR/push + schemalagd körning
- `secret-scan.yml`: secrets scanning med Gitleaks
- `ossf-scorecard.yml`: säkerhetsmognad via OSSF Scorecard
- `pr-title-policy.yml`: blockerar PR-titlar som inte följer Conventional Commit-format
- `pr-body-policy.yml`: validerar att PR-beskrivning följer template-sektioner
- `branch-name-policy.yml`: enforce branch-namn enligt `<type>/<description>`
- `changelog-policy.yml`: kräver changelog-decision labels för user-facing ändringar
- `policy-matrix-validate.yml`: validerar `.github/policy-matrix.json` (struktur, regex, labels)
- `policy-settings-alignment.yml`: säkerställer att `.github/settings.yml` och policy-matrisens required checks är synkade
- `policy-settings-autosync.yml`: skapar automatiskt PR med settings-fix när required checks driftar
- `policy-labels-alignment.yml`: validerar att `managedLabels` i policy-matrisen finns i `.github/labels.yml`
- `policy-labels-autosync.yml`: skapar automatiskt PR med labels-fix när label-governance driftar
- `policy-governance-report.yml`: publicerar/uppdaterar en löpande governance-statusrapport i GitHub Issues
- `policy-assistant-comment.yml`: kommenterar konkreta policy-fixar direkt på PR
- `release-readiness-gate.yml`: blockerar merge-ready vid policybrott (changelog/risk)
- `auto-label-pr.yml`: path-baserad auto-labeling av PR:er via `.github/labeler.yml`
- `auto-assign-reviewers.yml`: auto-tilldelar reviewers via `.github/auto_assign.yml`
- `pr-size-label.yml`: sätter `size/*`-labels baserat på ändringsstorlek
- `sync-labels.yml`: synkar label-definitioner från `.github/labels.yml`
- `stale-management.yml`: markerar/stänger inaktiva issues och PR:er enligt policy
- `route-to-project.yml`: (valfritt) skickar nya issues/PR:er till GitHub Project
- `workflow-lint.yml`: lintar GitHub workflows för syntax/policy-fel
- `policy-drift-guard.yml`: jämför branch protection mot baseline (optional strict mode)
- `_reusable-ci.yml`: återanvändbar CI-pipeline
- `_reusable-azure-deploy.yml`: återanvändbar Azure deploy-pipeline

Nödvändiga GitHub secrets/vars för deployment:

- `AZURE_CREDENTIALS` (secret)
- `AZURE_ENV_NAME` (repository/environment variable)
- `AZURE_LOCATION` (repository/environment variable)

För staging-wrapper:

- `AZURE_STAGING_ENV_NAME` (environment variable i `staging`)
- `AZURE_STAGING_LOCATION` (environment variable i `staging`)

För Vercel preview:

- `VERCEL_TOKEN` (secret)
- `VERCEL_ORG_ID` (secret)
- `VERCEL_PROJECT_ID` (secret)

För valfri project-routing:

- `GH_PROJECT_URL` (repository/environment variable), t.ex. `https://github.com/users/<user>/projects/<id>`
- `ADD_TO_PROJECT_PAT` (secret) med rättigheter för project write

För valfri strikt policy-drift guard:

- `STRICT_POLICY_GUARD=true` (repository/environment variable) för att faila workflow vid drift

## Enterprise setup (ingår)

- Reusable workflows för CI och Azure deploy
- CODEOWNERS för tydligt ägarskap
- `CONTRIBUTING.md` för bidragsflöde och PR-krav
- `CODE_OF_CONDUCT.md` för samarbetsnormer
- `SUPPORT.md` för support- och eskaleringsvägar
- PR-template med kvalitets- och releasechecklista
- Release automation för versionshantering och changelog
- Preview deploy-workflow med säker fallback om secrets saknas
- Dependabot för dependency- och workflow-uppdateringar
- Säker Dependabot auto-merge-policy (endast patch/minor)
- CodeQL för kontinuerlig säkerhetsskanning
- Commit quality gates via Husky + lint-staged + Commitlint
- PR-title policy + auto-labeling + stale management för bättre triage-flöde
- PR-body policy + branch-name policy + changelog policy
- Policy assistant-kommentarer + release readiness-gate
- Central policy-matris (`.github/policy-matrix.json`) som driver PR title/body, branch naming, changelog och readiness-regler
- Policy matrix validation workflow för att fånga fel i policykonfiguration tidigt
- Policy→settings alignment workflow som förhindrar drift i required checks
- Auto-sync workflow som öppnar PR automatiskt när `settings.yml` behöver uppdateras från policy-matrisen
- Policy→labels alignment workflow som fångar governance drift i labels taxonomi
- Labels auto-sync workflow som öppnar PR automatiskt när `labels.yml` behöver uppdateras eller metadata driftar mot policy-matrisen
- Governance report workflow som ger veckovis status på checks/labels alignment och drift
- Governance score (0-100) + trendhistorik i governance-report för snabb mognadsuppföljning
- Automatisk severity-klassning (Critical/High/Medium/Low) och prioriterad top-3 åtgärdsplan i governance-report
- Automatisk kritisk-eskalering: governance-report skapar/uppdaterar/stänger dedikerade issues för kritiska avvikelser (styrt via `governanceEscalation` i policy-matrisen)
- SLA-aging för kritiska avvikelser: auto-eskalering med labels/assignees/mentions och blocker-status i governance-report när tröskel passeras
- Auto-assign reviewers + PR-size labels + optional project-routing
- Workflow lint + secret scanning + OSSF scorecard + policy drift guard
- Issue templates (bug/feature) + triage-konfiguration
- Security policy (`SECURITY.md`) för privat sårbarhetsrapportering
- Repository settings as code (`.github/settings.yml`)
- Drift-runbook i `docs/runbook.md`
- Utvecklarkonsistens via `.editorconfig`, `.gitattributes` och `.nvmrc`

Konkreta steg för miljöskydd (required reviewers) finns i:

- `.github/github-settings-checklist.md`

Settings-as-code notis:

- `.github/settings.yml` används av t.ex. Probot Settings app eller GH CLI-script för att synka branch protection/repoinställningar.

## Nästa steg

- Lägg till autentisering (Entra ID / OAuth)
- Lägg till domänspecifik datamodell och migreringar
- Lägg till observability med Application Insights / Azure Monitor
