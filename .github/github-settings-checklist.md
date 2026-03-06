# GitHub Settings Checklist (Staging + Production)

Den här checklistan hjälper dig aktivera miljöskydd med required reviewers för Azure deploy.

## 1) Skapa environments

I GitHub: **Repo → Settings → Environments**

Skapa:

- `staging`
- `production`

## 2) Lägg required reviewers

För varje environment:

1. Öppna environment (t.ex. `production`)
2. Under **Deployment protection rules** välj **Required reviewers**
3. Lägg minst 1–2 reviewers (person eller team)
4. Spara

Rekommendation:

- `staging`: minst 1 reviewer
- `production`: minst 2 reviewers (eller 1 team + 1 individ)

## 3) Lägg environment variables

### Staging (Environment: `staging`)

- `AZURE_STAGING_ENV_NAME`
- `AZURE_STAGING_LOCATION`

### Production (Environment: `production`)

- `AZURE_ENV_NAME`
- `AZURE_LOCATION`

## 4) Lägg environment secrets

### Staging

- `AZURE_CREDENTIALS`

### Production

- `AZURE_CREDENTIALS`

> Om ni använder separata service principals: lägg olika `AZURE_CREDENTIALS` per environment.

## 5) Branch protection för `main`

I GitHub: **Repo → Settings → Branches → Add rule**

Aktivera:

- Require a pull request before merging
- Require approvals (minst 1, gärna 2)
- Require status checks to pass before merging
  - välj `CI / validate` (eller motsvarande check-namn)
- Require branches to be up to date before merging
- Block force pushes

## 6) Verifiera deployment-gates

1. Kör `Deploy to Azure (Staging)` workflow
2. Bekräfta att environment kräver reviewer innan jobben fortsätter
3. Kör `Deploy to Azure (Production)` manuellt (workflow_dispatch)
4. Bekräfta att production-gate kräver reviewer

## 7) Rekommenderade tillägg

- Begränsa deploy till `main` (redan i workflows)
- Aktivera audit-loggning via GitHub Enterprise/Org policies
- Kräv CODEOWNERS-review för `infra/**` och `.github/workflows/**`
- Aktivera Dependabot alerts + security updates i repository settings
- Verifiera att CodeQL-jobbet får skriva `security-events`
- Verifiera att `secret-scan.yml` och `ossf-scorecard.yml` får köra enligt era policyfönster
- Aktivera `STRICT_POLICY_GUARD=true` om ni vill blockera drift mot branch-protection-baseline
- Verifiera att branch-namnspolicyn accepteras av teamets branch-strategi (`branch-name-policy.yml`)
- Verifiera att PR-template innehåller changelog-beslut för user-facing ändringar (`changelog-policy.yml`)
- Verifiera att `release-readiness-gate.yml` är tillagd som required check för `main`
- Verifiera att `policy-matrix-validate.yml` är tillagd som required check för `main`
- Verifiera att `policy-settings-alignment.yml` är tillagd som required check för `main`
- Verifiera att `policy-labels-alignment.yml` är tillagd som required check för `main`
- Verifiera labels: `policy:needs-attention` och `risk:accepted`
- Verifiera att policyändringar görs i `.github/policy-matrix.json` och inte dupliceras i flera workflows
- Verifiera att `.github/settings.yml` contexts hålls synkade med `requiredStatusChecks` i `.github/policy-matrix.json`
- Verifiera att `.github/labels.yml` hålls synkad via `managedLabels` i `.github/policy-matrix.json` (inkl. `policy-labels-autosync.yml`)
- Verifiera att `policy-governance-report.yml` uppdaterar/skapar issue `Policy Governance Report`
- Verifiera att governance report visar `Governance score` och `Score trend`
- Verifiera att governance report visar severity-klassning och `Prioritized action plan (top 3)`
- Verifiera att kritiska avvikelser auto-eskaleras till separata issues och auto-stängs när avvikelsen är löst
- Verifiera att SLA-brott på kritiska avvikelser triggar extra eskalering (labels/mentions) och blocker-status i governance report

## 8) Aktivera governance-filer

- Verifiera issue templates under `New issue`:
  - `bug_report.yml`
  - `feature_request.yml`
- Verifiera att blank issues är avstängda via `ISSUE_TEMPLATE/config.yml`
- Verifiera att `SECURITY.md` visas i repository `Security policy`

## 9) Aktivera settings-as-code (valfritt men rekommenderat)

Filen `.github/settings.yml` är deklarativ policy.

För att applicera den krävs en mekanism, t.ex.:

- Probot Settings app
- Eget GitHub CLI-script i admin-flöde

Efter aktivering: verifiera branch protection för `main` och status check `CI / validate`.
