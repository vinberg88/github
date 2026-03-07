type SparklineProps = {
  values: number[];
  colorClassName?: string;
  label?: string;
};

export default function Sparkline({ values, colorClassName = "stroke-cyan-400", label = "Trend" }: SparklineProps) {
  const safeValues = values.length > 0 ? values : [0, 0, 0, 0];
  const maxValue = Math.max(...safeValues, 1);

  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * 100;
      const y = 100 - (value / maxValue) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-14 w-full rounded-lg border border-slate-700/60 bg-slate-950/60 p-2">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={label}>
        <title>{label}</title>
        <polyline fill="none" strokeWidth="4" points={points} className={colorClassName} />
      </svg>
    </div>
  );
}
