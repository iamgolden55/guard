// Sparkline — ported 1:1 from project/dashboard.jsx:115-130.
// Hand-rolled SVG. Uses currentColor when no `color` prop given so it
// inherits accent from the parent.
import { tokens } from "../tokens";

export interface SparklineProps {
  data: number[];
  /** Stroke + fill colour. Defaults to brand primary. */
  color?: string;
  w?: number;
  h?: number;
}

export function Sparkline({ data, color = tokens.color.primary, w = 120, h = 32 }: SparklineProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const len = data.length;

  const points = data
    .map((v, i) => {
      const x = (i / Math.max(len - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,${h} ${points} ${w},${h}`;
  const lastY = h - ((data[data.length - 1]! - min) / range) * (h - 4) - 2;

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polygon points={area} fill={color} fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}
