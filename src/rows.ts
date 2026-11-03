import { normalize, type Assignment, type Breakpoint, type GridConfig, type GridLayout } from './core';
import type { CellDef } from './types';

// A row is one line of the grid: a header that sets the view for the whole line, then a few slots for items.
// Row ids become CSS grid area names, so use letters, digits, - and _, starting with a letter.
export interface Row<V extends string = string> {
  id: string;
  view: V;
  slots: number;
}

// A section is a parent block: a titled panel holding rows. Sections move as a whole, rows move between them.
// Section ids share the cell-id namespace with rows (`${id}-s` is the header cell), so keep them distinct.
export interface Section<V extends string = string> {
  id: string;
  title: string;
  rows: Row<V>[];
}

type PerView<V extends string, R> = R | ((view: V) => R);

export interface RowLayoutOptions<V extends string = string> {
  columns?: number;
  gap?: number | string;
  height?: PerView<V, number | string>;
  // Extra space between sections, on top of the gap. Defaults to the --mg-section-space CSS variable.
  sectionSpace?: number | string;
  narrow?: false | { maxWidth?: number; columns?: number; perLine?: PerView<V, number>; height?: PerView<V, number | string> };
}

const at = <V extends string, R>(v: PerView<V, R>, view: V) => (typeof v === 'function' ? (v as (view: V) => R)(view) : v);
const px = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

export const rowHeadId = (row: Row) => `${row.id}-h`;
export const rowSlotId = (row: Row, slot: number) => `${row.id}-${slot}`;
export const rowSlotIds = (row: Row) => Array.from({ length: row.slots }, (_, k) => rowSlotId(row, k));
export const sectionHeadId = (s: Section) => `${s.id}-s`;
export const rowBand = (row: Row) => `row:${row.id}`;
export const sectionBand = (s: Section) => `section:${s.id}`;
export const allRows = <V extends string>(sections: Section<V>[]) => sections.flatMap((s) => s.rows);

export function rowCells<V extends string>(rows: Row<V>[]): CellDef<V>[] {
  return rows.flatMap((r) => [
    { id: rowHeadId(r), view: r.view, area: rowHeadId(r), locked: true, className: 'mg-rowhead' },
    ...rowSlotIds(r).map((id) => ({ id, view: r.view, area: id, className: 'mg-slot' })),
  ]);
}

// Section headers are locked cells; their view is the first row's (or `fallback`), which only matters for typing.
export function sectionCells<V extends string>(sections: Section<V>[], fallback?: V): CellDef<V>[] {
  return sections.flatMap((s) => [
    { id: sectionHeadId(s), view: (s.rows[0]?.view ?? fallback ?? '') as V, area: sectionHeadId(s), locked: true, className: 'mg-sectionhead' },
    ...rowCells(s.rows),
  ]);
}

type Lines = Pick<GridConfig, 'rows' | 'templateAreas' | 'bands'>;

// Builds grid-template-areas line by line, noting which grid lines each row and section spans (its "band").
function areas<V extends string>(
  sections: Section<V>[],
  headers: boolean,
  columns: number,
  perLine: (r: Row<V>) => number,
  height: (r: Row<V>) => string,
  space: string,
): Required<Lines> {
  const templateAreas: string[] = [];
  const heights: string[] = [];
  const bands: Record<string, string> = {};
  const line = (fill: string[], h: string) => {
    templateAreas.push(fill.join(' '));
    heights.push(h);
  };
  sections.forEach((s, si) => {
    if (headers && si > 0) line(Array(columns).fill('.'), space);
    const sStart = templateAreas.length + 1;
    if (headers) line(Array(columns).fill(sectionHeadId(s)), 'auto');
    for (const r of s.rows) {
      const rStart = templateAreas.length + 1;
      line(Array(columns).fill(rowHeadId(r)), 'auto');
      const ids = rowSlotIds(r);
      const per = Math.max(1, Math.min(perLine(r), ids.length));
      for (let k = 0; k < ids.length; k += per) {
        const chunk = ids.slice(k, k + per);
        // Spread the line's slots over the columns; the last one takes what's left over.
        const each = Math.floor(columns / chunk.length);
        line(chunk.flatMap((id, j) => Array(j === chunk.length - 1 ? columns - each * (chunk.length - 1) : each).fill(id)), height(r));
      }
      bands[rowBand(r)] = `${rStart} / ${templateAreas.length + 1}`;
    }
    if (headers) bands[sectionBand(s)] = `${sStart} / ${templateAreas.length + 1}`;
  });
  return { rows: heights.join(' '), templateAreas, bands };
}

function build<V extends string>(sections: Section<V>[], headers: boolean, opts: RowLayoutOptions<V>): GridLayout {
  const columns = opts.columns ?? 12;
  const space = px(opts.sectionSpace ?? 'var(--mg-section-space, 20px)');
  const height = (h: PerView<V, number | string>) => (r: Row<V>) => px(at(h, r.view));
  const base = areas(sections, headers, columns, (r) => r.slots, height(opts.height ?? 200), space);
  const layout: GridLayout = { columns, gap: opts.gap ?? 12, ...base };
  if (opts.narrow !== false) {
    const n = opts.narrow ?? {};
    const narrow: Breakpoint = {
      maxWidth: n.maxWidth ?? 720,
      columns: n.columns ?? 2,
      ...areas(sections, headers, n.columns ?? 2, (r) => at(n.perLine ?? 1, r.view), height(n.height ?? opts.height ?? 200), space),
    };
    layout.breakpoints = [narrow];
  }
  return layout;
}

export const rowLayout = <V extends string>(rows: Row<V>[], opts: RowLayoutOptions<V> = {}): GridLayout =>
  build([{ id: '', title: '', rows }], false, opts);

export const sectionLayout = <V extends string>(sections: Section<V>[], opts: RowLayoutOptions<V> = {}): GridLayout =>
  build(sections, true, opts);

export function findRow<V extends string>(rows: Row<V>[], cellId: string): { row: Row<V>; index: number; slot: number | null } | null {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (cellId === rowHeadId(row)) return { row, index, slot: null };
    const slot = rowSlotIds(row).indexOf(cellId);
    if (slot >= 0) return { row, index, slot };
  }
  return null;
}

// Items per row, slot by slot.
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

// A row's items after shrinking it to `slots`: empty slots go first (right-most empty first), and only once
// none are left do items fall off the end. Items keep their order.
export function shrinkRow<I>(items: readonly (I | null)[], slots: number): (I | null)[] {
  const out = [...items];
  while (out.length > Math.max(0, slots)) {
    const hole = out.lastIndexOf(null);
    out.splice(hole >= 0 ? hole : out.length - 1, 1);
  }
  return out;
}

export type RowPlace = { section: number; index: number };

export function locateRow(sections: Section[], rowId: string): RowPlace | null {
  for (let section = 0; section < sections.length; section++) {
    const index = sections[section].rows.findIndex((r) => r.id === rowId);
    if (index >= 0) return { section, index };
  }
  return null;
}

// Moves a row to `to` (index counted without the row itself). Returns the same array when nothing changes.
export function placeRow<V extends string>(sections: Section<V>[], rowId: string, to: RowPlace): Section<V>[] {
  const from = locateRow(sections, rowId);
  if (!from || (from.section === to.section && from.index === to.index)) return sections;
  const row = sections[from.section].rows[from.index];
  const out = sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== rowId) }));
  const dest = out[Math.max(0, Math.min(out.length - 1, to.section))];
  dest.rows.splice(Math.max(0, Math.min(dest.rows.length, to.index)), 0, row);
  return out;
}

// One step up or down; past the edge of a section the row crosses into the neighbouring one.
export function moveRow<V extends string>(sections: Section<V>[], rowId: string, delta: -1 | 1): Section<V>[] {
  const from = locateRow(sections, rowId);
  if (!from) return sections;
  const len = sections[from.section].rows.length;
  if (delta < 0 && from.index > 0) return placeRow(sections, rowId, { section: from.section, index: from.index - 1 });
  if (delta > 0 && from.index < len - 1) return placeRow(sections, rowId, { section: from.section, index: from.index + 1 });
  const next = from.section + delta;
  if (next < 0 || next >= sections.length) return sections;
  return placeRow(sections, rowId, { section: next, index: delta < 0 ? sections[next].rows.length : 0 });
}

export function placeSection<V extends string>(sections: Section<V>[], sectionId: string, to: number): Section<V>[] {
  const from = sections.findIndex((s) => s.id === sectionId);
  const clamped = Math.max(0, Math.min(sections.length - 1, to));
  if (from < 0 || from === clamped) return sections;
  const out = sections.filter((s) => s.id !== sectionId);
  out.splice(clamped, 0, sections[from]);
  return out;
}

export const moveSection = <V extends string>(sections: Section<V>[], sectionId: string, delta: -1 | 1) =>
  placeSection(sections, sectionId, sections.findIndex((s) => s.id === sectionId) + delta);

// The first `${prefix}${n}` not in `taken`.
export function freshId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let n = 0;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
