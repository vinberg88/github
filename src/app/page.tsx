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

export default async function Home() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

  const taskColumns: Array<{ title: string; key: Task["status"] }> = [
    { title: "Todo", key: "todo" },
    { title: "In progress", key: "in_progress" },
    { title: "In review", key: "in_review" },
    { title: "Done", key: "done" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Azure Enterprise Delivery Platform</h1>
          <p className="max-w-4xl text-slate-300">
            En större produktionsklar plattform med organisationslager, portfolio management, task orchestration,
            aktivitetsspårning och analytics. Allt deployat via Azure Container Apps + GitHub.
          </p>
          <p className="text-xs text-slate-400">API: {apiBase}</p>
          <a
            href="/auth-lab"
            className="inline-flex rounded-md border border-cyan-500 px-3 py-1 text-sm font-medium text-cyan-300 hover:bg-cyan-500/10"
          >
            Öppna Auth + Org Isolation Lab
          </a>
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
                  <span className="font-semibold text-cyan-300">{event.type}</span>
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
