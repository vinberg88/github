import OpsTicker from "./components/ops-ticker";
import QuickActions from "./components/quick-actions";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "blocked" | "completed" | "archived";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
  _count?: {
    tasks: number;
    events: number;
  };
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  size: number | null;
  _count: {
    projects: number;
    members: number;
  };
};

type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  project: {
    id: string;
    name: string;
    status: string;
  };
  assignee: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

type AnalyticsPayload = {
  totals: {
    organizations: number;
    members: number;
    projects: number;
    tasks: number;
    events: number;
  };
  projectsByStatus: Array<{ status: string; count: number }>;
  tasksByStatus: Array<{ status: string; count: number }>;
  tasksByPriority: Array<{ priority: string; count: number }>;
};

type EventItem = {
  id: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown> | null;
};

async function fetchFromApi<T>(apiBase: string, path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function percent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function eventTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export default async function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const githubRepoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? "https://github.com/vinberg88/github";
  const azurePortalUrl = process.env.NEXT_PUBLIC_AZURE_PORTAL_URL ?? "https://portal.azure.com/";
  const azureResourceGroupUrl =
    process.env.NEXT_PUBLIC_AZURE_RESOURCE_GROUP_URL ??
    "https://portal.azure.com/#view/HubsExtension/BrowseResourceGroups";
  const azureContainerAppsUrl =
    process.env.NEXT_PUBLIC_AZURE_CONTAINER_APPS_URL ??
    "https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.App%2FcontainerApps";

  const quickLinks: Array<{ label: string; href: string; group: "GitHub" | "Azure" | "Project" }> = [
    { label: "Repository", href: githubRepoUrl, group: "GitHub" },
    { label: "Pull Requests", href: `${githubRepoUrl}/pulls`, group: "GitHub" },
    { label: "Actions", href: `${githubRepoUrl}/actions`, group: "GitHub" },
    { label: "Issues", href: `${githubRepoUrl}/issues`, group: "GitHub" },
    { label: "Azure Portal", href: azurePortalUrl, group: "Azure" },
    { label: "Resource Groups", href: azureResourceGroupUrl, group: "Azure" },
    { label: "Container Apps", href: azureContainerAppsUrl, group: "Azure" },
    { label: "Azure Deploy Guide", href: `${githubRepoUrl}/blob/main/README.md#azure-deployment-azd`, group: "Azure" },
    { label: "Runbook", href: `${githubRepoUrl}/blob/main/docs/runbook.md`, group: "Project" },
    { label: "Contributing", href: `${githubRepoUrl}/blob/main/CONTRIBUTING.md`, group: "Project" },
    { label: "Security Policy", href: `${githubRepoUrl}/blob/main/SECURITY.md`, group: "Project" },
    { label: "Auth Lab", href: "/auth-lab", group: "Project" }
  ];

  const [projectPayload, organizationPayload, taskPayload, analytics, eventPayload] = await Promise.all([
    fetchFromApi<{ items: Project[] }>(apiBase, "/v1/projects?limit=8", { items: [] }),
    fetchFromApi<Organization[]>(apiBase, "/v1/organizations", []),
    fetchFromApi<{ items: Task[] }>(apiBase, "/v1/tasks?limit=20", { items: [] }),
    fetchFromApi<AnalyticsPayload>(apiBase, "/v1/analytics/overview", {
      totals: { organizations: 0, members: 0, projects: 0, tasks: 0, events: 0 },
      projectsByStatus: [],
      tasksByStatus: [],
      tasksByPriority: []
    }),
    fetchFromApi<{ items: EventItem[] }>(apiBase, "/v1/events?limit=12", { items: [] })
  ]);

  const latestProjects = projectPayload.items;
  const organizations = organizationPayload;
  const latestTasks = taskPayload.items;
  const latestEvents = eventPayload.items;

  const completedProjects = analytics.projectsByStatus.find((item) => item.status === "completed")?.count ?? 0;
  const blockedProjects = analytics.projectsByStatus.find((item) => item.status === "blocked")?.count ?? 0;
  const doneTasks = analytics.tasksByStatus.find((item) => item.status === "done")?.count ?? 0;
  const inProgressTasks = analytics.tasksByStatus.find((item) => item.status === "in_progress")?.count ?? 0;
  const urgentTasks = analytics.tasksByPriority.find((item) => item.priority === "urgent")?.count ?? 0;

  const projectCompletionPct = percent(completedProjects, analytics.totals.projects);
  const taskDeliveryPct = percent(doneTasks, analytics.totals.tasks);
  const blockedProjectPct = percent(blockedProjects, analytics.totals.projects);

  const eventTypeCounts = latestEvents.reduce<Record<string, number>>((acc, event) => {
    const key = event.type;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topEventTypes = Object.entries(eventTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const latestEventTimestamp = latestEvents.reduce((max, event) => {
    const eventTs = new Date(event.createdAt).getTime();
    return eventTs > max ? eventTs : max;
  }, 0);

  const last24hEvents =
    latestEventTimestamp === 0
      ? 0
      : latestEvents.filter((event) => latestEventTimestamp - new Date(event.createdAt).getTime() <= 86_400_000).length;

  const tickerItems = [
    `Projekt completion: ${projectCompletionPct}% (${completedProjects}/${analytics.totals.projects})`,
    `Task delivery: ${taskDeliveryPct}% (${doneTasks}/${analytics.totals.tasks})`,
    `Blocked projects: ${blockedProjects} (${blockedProjectPct}%)`,
    `Aktivitet senaste 24h: ${last24hEvents} events`,
    `Urgent tasks i kö: ${urgentTasks}`
  ];

  const pulseGrade = projectCompletionPct >= 70 && blockedProjects === 0 ? "A" : projectCompletionPct >= 45 ? "B" : "C";
  const pulseMessage =
    pulseGrade === "A"
      ? "Momentum är starkt. Teamet levererar stabilt."
      : pulseGrade === "B"
        ? "Stabil drift, men det finns flaskhalsar att plocka ner."
        : "Hög risknivå. Prioritera blocker-fix och triage av tasks.";

  const taskColumns: Array<{ title: string; key: Task["status"] }> = [
    { title: "Todo", key: "todo" },
    { title: "In progress", key: "in_progress" },
    { title: "In review", key: "in_review" },
    { title: "Done", key: "done" }
  ];

  const quickActions = [
    { label: "API Health", href: `${apiBase}/v1/health`, copyText: `${apiBase}/v1/health`, external: true },
    { label: "GitHub Actions", href: `${githubRepoUrl}/actions`, copyText: `${githubRepoUrl}/actions`, external: true },
    { label: "Open Issues", href: `${githubRepoUrl}/issues`, copyText: `${githubRepoUrl}/issues`, external: true },
    { label: "Azure Portal", href: azurePortalUrl, copyText: azurePortalUrl, external: true },
    {
      label: "Azure Resource Groups",
      href: azureResourceGroupUrl,
      copyText: azureResourceGroupUrl,
      external: true
    },
    {
      label: "Azure Container Apps",
      href: azureContainerAppsUrl,
      copyText: azureContainerAppsUrl,
      external: true
    },
    { label: "Auth Lab", href: "/auth-lab", copyText: "/auth-lab", external: false }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
        <header className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-6 shadow-2xl shadow-cyan-900/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
                Mission Control
              </p>
              <h1 className="text-4xl font-bold tracking-tight">Azure Enterprise Delivery Platform</h1>
              <p className="max-w-4xl text-slate-300">
                En produktionsklar kontrollpanel för organisationer, projekt, task-exekvering och operativa signaler.
                Här ser du leveranspuls, risker och aktivitetsmönster i realtid via API-data.
              </p>
              <p className="text-xs text-slate-400">API: {apiBase}</p>
            </div>

            <div className="min-w-[220px] rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-300">Delivery pulse</p>
              <p className="mt-1 text-3xl font-bold text-emerald-200">{pulseGrade}</p>
              <p className="mt-1 text-sm text-emerald-100/90">{pulseMessage}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <OpsTicker items={tickerItems} />
            <a
              href="/auth-lab"
              className="inline-flex items-center justify-center rounded-md border border-cyan-500 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10"
            >
              Öppna Auth + Org Isolation Lab
            </a>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-5">
          {[
            ["Organisationer", analytics.totals.organizations],
            ["Medlemmar", analytics.totals.members],
            ["Projekt", analytics.totals.projects],
            ["Tasks", analytics.totals.tasks],
            ["Events", analytics.totals.events]
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold text-cyan-300">{value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Quick links: GitHub + Azure + Project</h2>
            <p className="text-xs text-slate-400">Sätt `NEXT_PUBLIC_*_URL` i `.env` för att peka till din exakta miljö.</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
              {quickLinks.map((link) => {
                const isExternal = link.href.startsWith("http");

                return (
                  <a
                    key={`${link.group}-${link.label}`}
                    href={link.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noreferrer" : undefined}
                    className="group rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-cyan-500/60 hover:bg-cyan-500/5"
                  >
                    <p className="text-xs uppercase tracking-widest text-slate-400">{link.group}</p>
                    <p className="mt-1 text-sm font-semibold text-cyan-300 group-hover:text-cyan-200">{link.label}</p>
                    <p className="mt-2 line-clamp-1 text-xs text-slate-500">{link.href}</p>
                  </a>
                );
              })}
            </div>

            <QuickActions actions={quickActions} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">Execution health</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-center justify-between">
                <span>Project completion</span>
                <span className="font-semibold text-cyan-300">{projectCompletionPct}%</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Task delivery</span>
                <span className="font-semibold text-cyan-300">{taskDeliveryPct}%</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Blocked ratio</span>
                <span className="font-semibold text-cyan-300">{blockedProjectPct}%</span>
              </li>
              <li className="flex items-center justify-between">
                <span>In progress tasks</span>
                <span className="font-semibold text-cyan-300">{inProgressTasks}</span>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">Event hotspots</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {topEventTypes.length === 0 ? (
                <li>Ingen event-telemetri tillgänglig ännu.</li>
              ) : (
                topEventTypes.map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between">
                    <span>{eventTypeLabel(type)}</span>
                    <span className="font-semibold text-cyan-300">{count}</span>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">What to do next</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• Triagera {urgentTasks} st urgency-tasks för att minska brandkårsarbete.</li>
              <li>• Bryt ner blockerade projekt ({blockedProjects}) i handlingsbara tasks.</li>
              <li>• Följ upp event-intensitet ({last24hEvents} senaste 24h) för incidentspårning.</li>
            </ul>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">Projektstatus</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {analytics.projectsByStatus.length === 0 ? (
                <li>Ingen data ännu.</li>
              ) : (
                analytics.projectsByStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span>{row.status}</span>
                    <span className="font-semibold text-cyan-300">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">Taskstatus</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {analytics.tasksByStatus.length === 0 ? (
                <li>Ingen data ännu.</li>
              ) : (
                analytics.tasksByStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span>{row.status}</span>
                    <span className="font-semibold text-cyan-300">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold">Taskprioritet</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {analytics.tasksByPriority.length === 0 ? (
                <li>Ingen data ännu.</li>
              ) : (
                analytics.tasksByPriority.map((row) => (
                  <li key={row.priority} className="flex items-center justify-between">
                    <span>{row.priority}</span>
                    <span className="font-semibold text-cyan-300">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">Organisationer</h2>
            <ul className="mt-4 space-y-3">
              {organizations.length === 0 ? (
                <li className="text-sm text-slate-300">Ingen organisation ännu.</li>
              ) : (
                organizations.slice(0, 8).map((org) => (
                  <li key={org.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <p className="font-semibold text-cyan-300">{org.name}</p>
                    <p className="text-xs text-slate-400">/{org.slug}</p>
                    <p className="mt-2 text-sm text-slate-300">{org.industry ?? "Industry saknas"}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {org._count.projects} projekt · {org._count.members} medlemmar
                    </p>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">Projektportfölj</h2>
            <ul className="mt-4 space-y-3">
              {latestProjects.length === 0 ? (
                <li className="text-sm text-slate-300">Inga projekt än — skapa via `POST /v1/projects`.</li>
              ) : (
                latestProjects.map((project) => (
                  <li key={project.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-cyan-300">{project.name}</p>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {project.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{project.description ?? "Ingen beskrivning"}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Prioritet: {project.priority} · Tasks: {project._count?.tasks ?? 0} · Events: {project._count?.events ?? 0}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Task Board</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {taskColumns.map((column) => (
              <article key={column.key} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <h3 className="text-sm font-semibold text-slate-200">{column.title}</h3>
                <ul className="mt-3 space-y-2">
                  {latestTasks
                    .filter((task) => task.status === column.key)
                    .slice(0, 6)
                    .map((task) => (
                      <li key={task.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                        <p className="text-sm font-medium text-cyan-300">{task.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{task.project.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {task.assignee ? task.assignee.fullName : "Unassigned"} · {task.priority}
                        </p>
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Aktivitetsström</h2>
          <ul className="mt-4 space-y-2">
            {latestEvents.length === 0 ? (
              <li className="text-sm text-slate-300">Inga events än.</li>
            ) : (
              latestEvents.map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm">
                  <span className="font-semibold text-cyan-300">{eventTypeLabel(event.type)}</span>
                  <span className="ml-2 text-slate-400">
                    {new Date(event.createdAt).toLocaleString("sv-SE", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
