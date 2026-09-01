export interface Pt {
  x: number;
  y: number;
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1e-8) return Math.hypot(apx, apy);
  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

export function pathLength(points: Pt[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    n += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return n;
}

export function swipeHitsCircle(
  points: Pt[],
  cx: number,
  cy: number,
  r: number,
): { hit: boolean; angle: number; nx: number; ny: number } {
  const miss = { hit: false, angle: 0, nx: 1, ny: 0 };
  if (points.length < 2) return miss;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (distToSegment(cx, cy, a.x, a.y, b.x, b.y) <= r) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { hit: true, angle: Math.atan2(dy, dx), nx: -dy / len, ny: dx / len };
    }
  }
  return miss;
}
