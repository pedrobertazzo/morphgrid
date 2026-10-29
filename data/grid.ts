import type { Assignment } from '../src/core';
import { fillRows, type Row, type RowLayoutOptions } from '../src/rows';
import { pick } from './insights';
import type { Facet, Insight } from './types';

export type ViewKey = 'number' | 'bars' | 'list' | 'line' | 'scatter' | 'dots' | 'text' | 'progress';

export const CAPABILITIES: Record<ViewKey, { label: string; needs: Facet[] }> = {
  number: { label: 'Number', needs: ['value'] },
  bars: { label: 'Bars', needs: ['series'] },
  list: { label: 'List', needs: ['series'] },
  line: { label: 'Line', needs: ['trend'] },
  scatter: { label: 'Scatter', needs: ['points'] },
  dots: { label: 'Dots', needs: ['series'] },
  text: { label: 'Text', needs: ['line'] },
  progress: { label: 'Progress', needs: ['progress'] },
};

export const VIEW_KEYS = Object.keys(CAPABILITIES) as ViewKey[];

export function facets(i: Insight): Facet[] {
  const f: Facet[] = ['value', 'line'];
  if (i.series.length >= 2) f.push('series');
  if (i.trend) f.push('trend');
  if (i.points) f.push('points');
  if (i.progress) f.push('progress');
  if (i.image || i.series.some((e) => e.image)) f.push('image');
  return f;
}

export const fits = (i: Insight, v: ViewKey) => CAPABILITIES[v].needs.every((n) => facets(i).includes(n));

// When an item lacks what a cell's view needs, the cell falls back to the closest view it can draw.
// Every chain ends in a view every item supports, so a drop never fails.
export const CHAINS: Record<ViewKey, ViewKey[]> = {
  number: ['number'],
  text: ['text'],
  bars: ['bars', 'number'],
  list: ['list', 'bars', 'number'],
  line: ['line', 'bars', 'number'],
  scatter: ['scatter', 'dots', 'number'],
  dots: ['dots', 'number'],
  progress: ['progress', 'number'],
};

const MISSING: Record<Facet, string> = {
  value: 'no value',
  line: 'no summary',
  series: 'nothing to compare',
  trend: 'no time series',
  points: 'no x/y pairs',
  progress: 'no share to show',
  image: 'no images',
};

export interface Resolved {
  view: ViewKey;
  fallback: boolean;
  reason?: string;
}

export function resolve(i: Insight, cellView: ViewKey): Resolved {
  const view = CHAINS[cellView].find((v) => fits(i, v)) ?? 'number';
  if (view === cellView) return { view, fallback: false };
  const lacking = CAPABILITIES[cellView].needs.find((n) => !facets(i).includes(n));
  return { view, fallback: true, reason: lacking && MISSING[lacking] };
}

export const viewsFor = (i: Insight) => VIEW_KEYS.filter((v) => fits(i, v));

export const MAX_SLOTS = 4;

const SLOTS: Record<ViewKey, number> = { number: 4, progress: 4, text: 3, bars: 3, list: 3, dots: 3, line: 2, scatter: 2 };
const HEIGHT: Record<ViewKey, number> = { number: 130, progress: 160, text: 170, bars: 230, list: 280, dots: 230, line: 230, scatter: 290 };

export const slotsFor = (v: ViewKey) => SLOTS[v];

export const ROW_LAYOUT: RowLayoutOptions<ViewKey> = {
  height: (v) => HEIGHT[v],
  narrow: { perLine: (v) => (v === 'number' || v === 'progress' ? 2 : 1) },
};

export interface AutoRows {
  rows: Row<ViewKey>[];
  value: Assignment;
}

// Suggest a starting board: a row of headline numbers, then one row per kind of chart the data supports.
export function autoRows(insights: Insight[]): AutoRows {
  const ranked = pick(insights, insights.length);
  const used = new Set<string>();
  const take = (n: number, ok: (i: Insight) => boolean) => {
    const got = ranked.filter((i) => !used.has(i.key) && ok(i)).slice(0, n);
    got.forEach((i) => used.add(i.key));
    return got.map((i) => i.key);
  };
  const plan: [ViewKey, string[]][] = [
    ['line', take(SLOTS.line, (i) => i.kind === 'trend')],
    ['scatter', take(SLOTS.scatter, (i) => i.kind === 'relation' || i.kind === 'geo')],
    ['bars', take(SLOTS.bars, (i) => (i.kind === 'breakdown' || i.kind === 'count') && fits(i, 'bars'))],
    ['list', take(SLOTS.list, (i) => i.kind === 'top')],
  ];
  // Correlations make poor headline figures; totals and counts make good ones.
  plan.unshift(['number', take(SLOTS.number, (i) => i.kind !== 'relation')]);
  const filled = plan.filter(([, keys]) => keys.length);
  const rows = filled.map(([view, keys], n) => ({ id: `r${n}`, view, slots: keys.length }));
  return { rows, value: fillRows(rows, filled.map(([, keys]) => keys)) };
}
