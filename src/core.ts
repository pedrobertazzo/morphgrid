export type Assignment = Readonly<Record<string, string | null>>;
export type Rect = { left: number; top: number; width: number; height: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type CanPlace = (itemId: string, cellId: string) => boolean;

export type Move = { itemId: string; from: string | null; to: string | null };

const allow: CanPlace = () => true;

export function defaultAssignment(cellIds: readonly string[], itemIds: readonly string[]): Assignment {
  const a: Record<string, string | null> = {};
  cellIds.forEach((c, i) => (a[c] = itemIds[i] ?? null));
  return a;
}

export function normalize(a: Assignment, cellIds: readonly string[], itemIds: readonly string[]): Assignment {
  const known = new Set(itemIds);
  const seen = new Set<string>();
  const out: Record<string, string | null> = {};
  for (const c of cellIds) {
    const v = a[c];
    if (v != null && known.has(v) && !seen.has(v)) {
      out[c] = v;
      seen.add(v);
    } else out[c] = null;
  }
  return out;
}

export function findCell(a: Assignment, itemId: string): string | null {
  for (const k in a) if (a[k] === itemId) return k;
  return null;
}

export function placeItem(
  base: Assignment,
  itemId: string,
  target: string,
  canPlace: CanPlace = allow,
): Assignment | null {
  if (!(target in base)) return null;
  const home = findCell(base, itemId);
  if (home === target) return base;
  if (!canPlace(itemId, target)) return null;
  const occupant = base[target];
  if (occupant && home && !canPlace(occupant, home)) return null;
  const next: Record<string, string | null> = { ...base, [target]: itemId };
  if (home) next[home] = occupant ?? null;
  return next;
}

export function cycleItem(
  base: Assignment,
  cellId: string,
  order: readonly string[],
  dir: 1 | -1,
  canPlace: CanPlace = allow,
): { next: Assignment; itemId: string } | null {
  const n = order.length;
  if (!n) return null;
  const cur = base[cellId];
  const idx = cur ? order.indexOf(cur) : dir > 0 ? -1 : 0;
  for (let step = 1; step <= n; step++) {
    const cand = order[(((idx + dir * step) % n) + n) % n];
    if (cand === cur) continue;
    const next = placeItem(base, cand, cellId, canPlace);
    if (next) return { next, itemId: cand };
  }
  return null;
}

export function diff(prev: Assignment, next: Assignment): Move[] {
  const from = new Map<string, string>();
  const to = new Map<string, string>();
  for (const k in prev) if (prev[k]) from.set(prev[k]!, k);
  for (const k in next) if (next[k]) to.set(next[k]!, k);
  const ids = new Set([...from.keys(), ...to.keys()]);
  const moves: Move[] = [];
  for (const id of ids) {
    const f = from.get(id) ?? null;
    const t = to.get(id) ?? null;
    if (f !== t) moves.push({ itemId: id, from: f, to: t });
  }
  return moves;
}

export function sameAssignment(a: Assignment, b: Assignment): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

export function hitTest(rects: Record<string, Rect>, x: number, y: number): string | null {
  for (const id in rects) {
    const r = rects[id];
    if (x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height) return id;
  }
  return null;
}

const DIRS: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

export function findNeighbor(rects: Record<string, Rect>, from: string, dir: Direction): string | null {
  const cur = rects[from];
  if (!cur) return null;
  const [dx, dy] = DIRS[dir];
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id in rects) {
    if (id === from) continue;
    const r = rects[id];
    const x = r.left + r.width / 2 - cx;
    const y = r.top + r.height / 2 - cy;
    const along = x * dx + y * dy;
    const across = Math.abs(x * dy - y * dx);
    const score = along + across * 2;
    if (along > 4 && score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

// Where an arrow key sends an item: the nearest cell that direction that would take it. Locked and
// refusing cells are skipped, so a row of headers or a locked cell doesn't stop keyboard moves.
export function findMove(
  a: Assignment,
  rects: Record<string, Rect>,
  itemId: string,
  dir: Direction,
  canPlace: CanPlace = allow,
): string | null {
  const from = findCell(a, itemId);
  if (!from || !rects[from]) return null;
  const open: Record<string, Rect> = {};
  for (const id in rects) if (id === from || placeItem(a, itemId, id, canPlace)) open[id] = rects[id];
  return findNeighbor(open, from, dir);
}

export type Shape = 'wide' | 'tall' | 'square';
export type ShapeThresholds = { wide: number; tall: number };

export const DEFAULT_SHAPE: ShapeThresholds = { wide: 1.5, tall: 0.8 };

export function getShape(width: number, height: number, t: ShapeThresholds = DEFAULT_SHAPE): Shape {
  if (!width || !height) return 'square';
  const r = width / height;
  return r > t.wide ? 'wide' : r < t.tall ? 'tall' : 'square';
}

export interface GridConfig {
  columns?: number | string;
  rows?: number | string;
  rowHeight?: number | string;
  gap?: number | string;
  templateAreas?: string[];
  areas?: Record<string, string>;
}

export interface Breakpoint extends GridConfig {
  maxWidth: number;
}

export interface GridLayout extends GridConfig {
  breakpoints?: Breakpoint[];
}

export function resolveLayout(layout: GridLayout, width: number): GridConfig {
  const { breakpoints, ...base } = layout;
  if (!breakpoints?.length || !width) return base;
  const match = breakpoints
    .filter((b) => width <= b.maxWidth)
    .sort((a, b) => a.maxWidth - b.maxWidth)[0];
  if (!match) return base;
  const { maxWidth: _ignored, ...over } = match;
  return { ...base, ...over, areas: { ...base.areas, ...over.areas } };
}

const px = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v);
const track = (v: number | string | undefined) =>
  typeof v === 'number' ? `repeat(${v}, minmax(0, 1fr))` : v;

export function gridStyle(c: GridConfig): Record<string, string | undefined> {
  return {
    gridTemplateColumns: track(c.columns),
    gridTemplateRows: track(c.rows),
    gridAutoRows: px(c.rowHeight),
    gap: px(c.gap),
    gridTemplateAreas: c.templateAreas?.map((r) => `"${r}"`).join(' '),
  };
}
