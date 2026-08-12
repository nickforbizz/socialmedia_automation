import type { DailyPoint } from "@/features/analytics/aggregate";

/**
 * Dependency-free inline SVG area chart of daily engagement. Server-rendered
 * (no interactivity), scaled to the data with a baseline and a highlighted last
 * point. Uses theme CSS variables so it adapts to dark mode.
 */
export function EngagementChart({ points }: { points: DailyPoint[] }) {
  const width = 720;
  const height = 180;
  const pad = 24;

  const values = points.map((p) => p.engagement);
  const max = Math.max(1, ...values);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const scaleY = (v: number) => height - pad - (v / max) * (height - pad * 2);

  const coords = points.map((p, i) => ({ x: pad + i * stepX, y: scaleY(p.engagement) }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area =
    coords.length > 0
      ? `${pad},${height - pad} ${line} ${(pad + (points.length - 1) * stepX).toFixed(1)},${height - pad}`
      : "";
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full"
      role="img"
      aria-label="Daily engagement trend"
    >
      <polygon points={area} fill="hsl(var(--primary))" opacity={0.08} />
      <polyline
        points={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && <circle cx={last.x} cy={last.y} r={3.5} fill="hsl(var(--primary))" />}
      {/* baseline */}
      <line
        x1={pad}
        y1={height - pad}
        x2={width - pad}
        y2={height - pad}
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
    </svg>
  );
}
