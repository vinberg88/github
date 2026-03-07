"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/80 hover:text-cyan-200"
      aria-label="Toggle color theme"
      title="Växla mellan mörkt och ljust tema"
    >
      {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
