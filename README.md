# github
GitHub - Build apps via Azure - Microsoft - 2026

## Bygg appar via Azure och Github - 2026

Här är en praktisk och modern översikt (2026-perspektiv) över hur du bygger och distribuerar appar till Azure med GitHub som huvudsaklig källa och verktyg.

## Snabb rekommendation beroende på din app

| Scenario | Rekommenderad lösning |
|---|---|
| Ren frontend / JAMstack | Azure Static Web Apps (bäst DX) |
| Traditionell backend eller API | Azure App Service + GitHub Actions med OIDC |
| Behöver skalbarhet, sidecars, Dapr, multi-replica | Azure Container Apps |
| Mycket trafik + global edge | Azure Front Door + Static Web Apps / Container Apps |
| Bara API:er utan frontend | Azure Functions eller Container Apps |

## Azure DevOps och GitHub

Azure DevOps och GitHub integreras väldigt bra idag, särskilt om du vill behålla:

- **Azure Boards** – planering, backlog, sprintar
- **Azure Pipelines** – CI/CD

...medan koden bor på GitHub.

---

Hoppas du får en bra dag // Mattias Vinberg
