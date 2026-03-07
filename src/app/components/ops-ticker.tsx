"use client";

import { useEffect, useMemo, useState } from "react";

type OpsTickerProps = {
  items: string[];
};

export default function OpsTicker({ items }: OpsTickerProps) {
  const safeItems = useMemo(() => (items.length > 0 ? items : ["Inga signaler ännu."]), [items]);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (safeItems.length <= 1 || reducedMotion) {
      return;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [safeItems, reducedMotion]);

  return (
    <div
      className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs uppercase tracking-wider text-cyan-300">Ops ticker</p>
      <p className="mt-1 font-medium">{safeItems[index]}</p>
    </div>
  );
}
