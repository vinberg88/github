"use client";

import { FormEvent, useMemo, useState } from "react";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string;
  };
};

type SessionItem = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

type ApiResult = {
  status: number;
  body: unknown;
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AuthLabPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  const [email, setEmail] = useState("owner@acme.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [registerName, setRegisterName] = useState("Demo User");
  const [registerEmail, setRegisterEmail] = useState("demo.user@acme.local");
  const [registerPassword, setRegisterPassword] = useState("ChangeMe123!");
  const [registerRole, setRegisterRole] = useState("contributor");

  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [log, setLog] = useState<string>("Ready.\n");

  const authHeader = useMemo<HeadersInit | undefined>(() => {
    if (!accessToken) {
      return undefined;
    }

    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  async function request(path: string, init?: RequestInit): Promise<ApiResult> {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      status: response.status,
      body
    };
  }

  function appendLog(title: string, result: ApiResult) {
    setLog((prev) => `${prev}\n## ${title}\nStatus: ${result.status}\n${pretty(result.body)}\n`);
  }

  async function handleSessions() {
    const result = await request("/v1/auth/sessions", {
      method: "GET",
      headers: authHeader
    });

    appendLog("List sessions", result);

    if (result.status >= 200 && result.status < 300) {
      const body = result.body as { items?: SessionItem[] };
      setSessions(body.items ?? []);
    }
  }

  async function handleRevokeSession(id: string) {
    const result = await request(`/v1/auth/sessions/${id}`, {
      method: "DELETE",
      headers: authHeader
    });

    appendLog(`Revoke session ${id}`, result);

    if (result.status >= 200 && result.status < 300) {
      await handleSessions();
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    const result = await request("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    appendLog("Login", result);

    if (result.status >= 200 && result.status < 300) {
      const parsed = result.body as LoginResponse;
      setAccessToken(parsed.accessToken);
      setRefreshToken(parsed.refreshToken);
      await handleSessions();
    }
  }

  async function handleRefresh() {
    const result = await request("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });

    appendLog("Refresh", result);

    if (result.status >= 200 && result.status < 300) {
      const parsed = result.body as LoginResponse;
      setAccessToken(parsed.accessToken);
      setRefreshToken(parsed.refreshToken);
      await handleSessions();
    }
  }

  async function handleLogout(allSessions: boolean) {
    const result = await request("/v1/auth/logout", {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        allSessions,
        refreshToken: allSessions ? undefined : refreshToken
      })
    });

    appendLog(allSessions ? "Logout (all sessions)" : "Logout (single session)", result);

    if (result.status >= 200 && result.status < 300) {
      setAccessToken("");
      setRefreshToken("");
      setSessions([]);
    }
  }

  async function handleMe() {
    const result = await request("/v1/auth/me", {
      method: "GET",
      headers: authHeader
    });

    appendLog("Auth me", result);
  }

  async function handleProjectsScoped() {
    const result = await request("/v1/projects?limit=10", {
      method: "GET",
      headers: authHeader
    });

    appendLog("Projects (org-scoped)", result);
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();

    const result = await request("/v1/auth/register", {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        fullName: registerName,
        email: registerEmail,
        password: registerPassword,
        role: registerRole
      })
    });

    appendLog("Register member (current org)", result);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <main className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <h1 className="text-2xl font-bold">Auth + Org Isolation Lab</h1>
          <p className="text-sm text-slate-300">
            Testa backend-flöden för access/refresh/logout/sessions och verifiera att data är org-isolerad. API: {apiBase}
          </p>

          <form onSubmit={handleLogin} className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
            />
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type="password"
            />
            <button className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400" type="submit">
              Login
            </button>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
              type="button"
              onClick={handleRefresh}
            >
              Refresh Token
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" onClick={handleMe}>
              GET /auth/me
            </button>
            <button className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" onClick={handleProjectsScoped}>
              GET /projects (scoped)
            </button>
            <button className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" onClick={handleSessions}>
              GET /auth/sessions
            </button>
            <button className="rounded-md border border-amber-500 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10" onClick={() => handleLogout(false)}>
              Logout (this session)
            </button>
            <button className="rounded-md border border-rose-500 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10" onClick={() => handleLogout(true)}>
              Logout (all sessions)
            </button>
          </div>

          <form onSubmit={handleRegister} className="grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-2">
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              placeholder="full name"
            />
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              placeholder="member email"
            />
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              placeholder="member password"
              type="password"
            />
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={registerRole}
              onChange={(e) => setRegisterRole(e.target.value)}
            >
              <option value="contributor">contributor</option>
              <option value="viewer">viewer</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
            <button className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400" type="submit">
              Register in current org
            </button>
          </form>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Token State</h2>
          <div className="space-y-2 text-xs text-slate-300">
            <p>Access token:</p>
            <pre className="max-h-24 overflow-auto rounded bg-slate-950 p-2">{accessToken || "(none)"}</pre>
            <p>Refresh token:</p>
            <pre className="max-h-24 overflow-auto rounded bg-slate-950 p-2">{refreshToken || "(none)"}</pre>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Active Sessions</h2>
          {sessions.length === 0 ? (
            <p className="mb-6 text-sm text-slate-400">No active sessions loaded.</p>
          ) : (
            <ul className="mb-6 space-y-2">
              {sessions.map((session) => (
                <li key={session.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                  <p className="font-medium text-slate-200">Session: {session.id}</p>
                  <p className="text-slate-400">IP: {session.ipAddress ?? "unknown"}</p>
                  <p className="text-slate-400">UA: {session.userAgent ?? "unknown"}</p>
                  <p className="text-slate-400">Created: {session.createdAt}</p>
                  <p className="text-slate-400">Last used: {session.lastUsedAt ?? "n/a"}</p>
                  <p className="text-slate-400">Expires: {session.expiresAt}</p>
                  <button
                    className="mt-2 rounded border border-rose-500 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    Revoke this session
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-3 text-lg font-semibold">Run Log</h2>
          <pre className="max-h-[45vh] overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">{log}</pre>
        </section>
      </main>
    </div>
  );
}
