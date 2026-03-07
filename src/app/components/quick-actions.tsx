"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type QuickAction = {
  label: string;
  href: string;
  copyText?: string;
  external?: boolean;
};

type QuickActionsProps = {
  actions: QuickAction[];
};

export default function QuickActions({ actions }: QuickActionsProps) {
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return actions;
    }

    return actions.filter((action) => {
      return action.label.toLowerCase().includes(normalizedQuery) || action.href.toLowerCase().includes(normalizedQuery);
    });
  }, [actions, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCmdOrCtrlK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

      if (isCmdOrCtrlK || isSlash) {
        event.preventDefault();
        inputRef.current?.focus();
        setMessage("Sök aktiv (Esc för att rensa)");
        setTimeout(() => setMessage(""), 1800);
      }

      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        setMessage("Sök rensad");
        setTimeout(() => setMessage(""), 1500);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} kopierad`);
      setTimeout(() => setMessage(""), 1800);
    } catch {
      setMessage("Kunde inte kopiera");
      setTimeout(() => setMessage(""), 1800);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-4" aria-labelledby="quick-actions-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id="quick-actions-heading" className="text-sm font-semibold text-cyan-300">
          Quick Actions
        </h3>
        <p id={id} aria-live="polite" className="text-xs text-emerald-300">
          {message}
        </p>
      </div>

      <label htmlFor="quick-actions-search" className="sr-only">
        Sök quick actions
      </label>
      <input
        id="quick-actions-search"
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Sök actions... (⌘/Ctrl+K eller /)"
        className="mb-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400/70 placeholder:text-slate-500 focus:ring"
      />

      <ul className="space-y-2">
        {filteredActions.map((action) => (
          <li key={action.label} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-sm font-medium text-slate-100">{action.label}</p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{action.href}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noreferrer" : undefined}
                className="rounded-md border border-cyan-500/70 px-2.5 py-1 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/10"
              >
                Öppna
              </a>
              <button
                type="button"
                onClick={() => copy(action.copyText ?? action.href, action.label)}
                className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-400"
              >
                Kopiera
              </button>
            </div>
          </li>
        ))}

        {filteredActions.length === 0 ? (
          <li className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
            Inga actions matchar sökningen.
          </li>
        ) : null}
      </ul>

      <p className="mt-3 text-[11px] text-slate-500">Tips: tryck / eller Ctrl+K för snabbfokus.</p>
    </section>
  );
}
