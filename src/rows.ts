import { normalize, type Assignment, type Breakpoint, type GridLayout } from './core';
import type { CellDef } from './types';

// A row is one line of the grid: a header that sets the view for the whole line, then a few slots for items.
// Row ids become CSS grid area names, so use letters, digits, - and _, starting with a letter.
export interface Row<V extends string = string> {
  id: string;
  view: V;
  slots: number;
}

type PerView<V extends string, R> = R | ((view: V) => R);

export interface RowLayoutOptions<V extends string = string> {
  columns?: number;
  gap?: number | string;
  height?: PerView<V, number | string>;
  narrow?: false | { maxWidth?: number; columns?: number; perLine?: PerView<V, number>; height?: PerView<V, number | string> };
}

const at = <V extends string, R>(v: PerView<V, R>, view: V) => (typeof v === 'function' ? (v as (view: V) => R)(view) : v);
const px = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

export const rowHeadId = (row: Row) => `${row.id}-h`;
export const rowSlotId = (row: Row, slot: number) => `${row.id}-${slot}`;
export const rowSlotIds = (row: Row) => Array.from({ length: row.slots }, (_, k) => rowSlotId(row, k));

export function rowCells<V extends string>(rows: Row<V>[]): CellDef<V>[] {
  return rows.flatMap((r) => [
    { id: rowHeadId(r), view: r.view, area: rowHeadId(r), locked: true, className: 'mg-rowhead' },
    ...rowSlotIds(r).map((id) => ({ id, view: r.view, area: id, className: 'mg-slot' })),
  ]);
}

function areas<V extends string>(rows: Row<V>[], columns: number, perLine: (r: Row<V>) => number, height: (r: Row<V>) => string) {
  const templateAreas: string[] = [];
  const heights: string[] = [];
  for (const r of rows) {
    templateAreas.push(Array(columns).fill(rowHeadId(r)).join(' '));
    heights.push('auto');
    const ids = rowSlotIds(r);
    const per = Math.max(1, Math.min(perLine(r), ids.length));
    for (let k = 0; k < ids.length; k += per) {
      const line = ids.slice(k, k + per);
      // Spread the line's slots over the columns; the last one takes what's left over.
      const each = Math.floor(columns / line.length);
      templateAreas.push(line.flatMap((id, j) => Array(j === line.length - 1 ? columns - each * (line.length - 1) : each).fill(id)).join(' '));
      heights.push(height(r));
    }
  }
  return { rows: heights.join(' '), templateAreas };
}

export function rowLayout<V extends string>(rows: Row<V>[], opts: RowLayoutOptions<V> = {}): GridLayout {
  const columns = opts.columns ?? 12;
  const height = (h: PerView<V, number | string>) => (r: Row<V>) => px(at(h, r.view));
  const base = areas(rows, columns, (r) => r.slots, height(opts.height ?? 200));
  const layout: GridLayout = { columns, gap: opts.gap ?? 12, ...base };
  if (opts.narrow !== false) {
    const n = opts.narrow ?? {};
    const narrow: Breakpoint = {
      maxWidth: n.maxWidth ?? 720,
      columns: n.columns ?? 2,
      ...areas(rows, n.columns ?? 2, (r) => at(n.perLine ?? 1, r.view), height(n.height ?? opts.height ?? 200)),
    };
    layout.breakpoints = [narrow];
  }
  return layout;
}

export function findRow<V extends string>(rows: Row<V>[], cellId: string): { row: Row<V>; index: number; slot: number | null } | null {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (cellId === rowHeadId(row)) return { row, index, slot: null };
    const slot = rowSlotIds(row).indexOf(cellId);
    if (slot >= 0) return { row, index, slot };
  }
  return null;
}

// Items per row, slot by slot. Handy for saving a board.
export function rowItems(rows: Row[], a: Assignment): (string | null)[][] {
  return rows.map((r) => rowSlotIds(r).map((id) => a[id] ?? null));
}

// The inverse of rowItems: lay items into the rows' slots. Headers stay empty.
export function fillRows(rows: Row[], items: readonly (readonly (string | null)[])[]): Assignment {
  const out: Record<string, string | null> = {};
  rows.forEach((r, i) => {
    out[rowHeadId(r)] = null;
    rowSlotIds(r).forEach((id, k) => (out[id] = items[i]?.[k] ?? null));
  });
  return out;
}

// Drops items whose slot no longer exists, so they don't come back when the slot does.
export function pruneRows(a: Assignment, rows: Row[], itemIds: readonly string[]): Assignment {
  return normalize(a, rowCells(rows).map((c) => c.id), itemIds);
}
