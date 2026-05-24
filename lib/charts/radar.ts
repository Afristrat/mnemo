export type Point = { x: number; y: number };

/**
 * Calcule les sommets d'un radar à N axes répartis régulièrement,
 * en partant du haut (−90°) et en tournant dans le sens horaire.
 * Fonction pure, testable.
 */
export function computeRadarPoints(
  values: number[],
  options: { max: number; radius: number; cx: number; cy: number },
): Point[] {
  const { max, radius, cx, cy } = options;
  const n = values.length;
  if (n === 0) return [];
  return values.map((value, i) => {
    const ratio = max === 0 ? 0 : Math.min(Math.max(value, 0), max) / max;
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    };
  });
}

/** Sérialise une liste de points en attribut `points` d'un <polygon> SVG. */
export function toPolygonPoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
