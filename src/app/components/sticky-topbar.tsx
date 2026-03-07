import ThemeToggle from "./theme-toggle";

type StickyTopbarProps = {
  repoUrl: string;
  azureUrl: string;
};

const sectionLinks = [
  { label: "Overview", href: "#overview" },
  { label: "Links", href: "#links" },
  { label: "Radar", href: "#radar" },
  { label: "Insights", href: "#insights" },
  { label: "Control", href: "#control" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Board", href: "#board" },
  { label: "Activity", href: "#activity" }
];

export default function StickyTopbar({ repoUrl, azureUrl }: StickyTopbarProps) {
  return (
    <div className="sticky top-3 z-40 mx-auto w-full max-w-7xl px-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">Mission Control</span>
        </div>

        <nav className="hidden md:block" aria-label="Sektioner">
          <ul className="flex flex-wrap items-center gap-2">
            {sectionLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-full border border-slate-700/70 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-500/70 hover:text-cyan-200"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-700/70 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/70 hover:text-cyan-200"
          >
            GitHub
          </a>
          <a
            href={azureUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-700/70 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/70 hover:text-cyan-200"
          >
            Azure
          </a>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
