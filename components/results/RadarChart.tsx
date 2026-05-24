import type { ReactElement } from "react";
import { computeRadarPoints, toPolygonPoints } from "@/lib/charts/radar";

type RadarDatum = { label: string; score: number };

type RadarChartProps = {
  data: RadarDatum[];
  max?: number;
  size?: number;
};

const RINGS = [0.25, 0.5, 0.75, 1] as const;

/** Radar des dimensions de scoring, rendu en SVG pur (aucune dépendance de charting). */
export function RadarChart({ data, max = 10, size = 320 }: RadarChartProps): ReactElement {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 52;
  const dataPoints = computeRadarPoints(
    data.map((d) => d.score),
    { max, radius, cx, cy },
  );
  const axisPoints = computeRadarPoints(
    data.map(() => max),
    { max, radius, cx, cy },
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Radar des ${data.length} dimensions`}
      className="h-auto w-full max-w-sm"
    >
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={toPolygonPoints(
            computeRadarPoints(
              data.map(() => max * r),
              { max, radius, cx, cy },
            ),
          )}
          fill="none"
          stroke="#bcc9c6"
          strokeWidth={1}
        />
      ))}
      {axisPoints.map((p, i) => (
        <line key={data[i].label} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#bcc9c6" strokeWidth={1} />
      ))}
      <polygon
        points={toPolygonPoints(dataPoints)}
        fill="rgba(0,104,95,0.18)"
        stroke="#00685f"
        strokeWidth={2}
      />
      {dataPoints.map((p, i) => (
        <circle key={data[i].label} cx={p.x} cy={p.y} r={3} fill="#00685f" />
      ))}
      {axisPoints.map((p, i) => (
        <text
          key={`${data[i].label}-label`}
          x={cx + (p.x - cx) * 1.16}
          y={cy + (p.y - cy) * 1.16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#3d4947"
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  );
}
