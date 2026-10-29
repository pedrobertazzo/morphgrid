import type { Row } from './types';

export interface DataAdapter {
  id: string;
  canHandle(input: unknown): boolean;
  parse(input: unknown): Row[];
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function flatten(obj: Record<string, unknown>, depth = 2, prefix = '', out: Row = {}): Row {
  for (const k in obj) {
    const v = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlain(v) && depth > 0) flatten(v, depth - 1, key, out);
    else out[key] = v;
  }
  return out;
}

// Finds the record array inside common API envelopes: [..], { data: [..] }, { response: { games: [..] } }, { id: {..}, id2: {..} }.
function largestArray(v: unknown, depth: number): Record<string, unknown>[] | null {
  if (Array.isArray(v)) return v.some(isPlain) ? v.filter(isPlain) : null;
  if (!isPlain(v) || depth === 0) return null;
  let best: Record<string, unknown>[] | null = null;
  for (const x of Object.values(v)) {
    const a = largestArray(x, depth - 1);
    if (a && (!best || a.length > best.length)) best = a;
  }
  return best;
}

function records(input: unknown): Record<string, unknown>[] {
  const found = largestArray(input, 3);
  if (found) return found;
  if (!isPlain(input)) return [];
  const vals = Object.entries(input);
  if (vals.length > 1 && vals.every(([, v]) => isPlain(v))) return vals.map(([k, v]) => ({ key: k, ...(v as object) }));
  return [input];
}

export const jsonAdapter: DataAdapter = {
  id: 'json',
  canHandle: (input) => Array.isArray(input) || isPlain(input) || (typeof input === 'string' && /^\s*[[{]/.test(input)),
  parse: (input) => records(typeof input === 'string' ? JSON.parse(input) : input).map((r) => flatten(r)),
};

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const delim = [',', ';', '\t'].sort((a, b) => count(text.split('\n')[0], b) - count(text.split('\n')[0], a))[0];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) row.push(cur), (cur = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur), rows.push(row), (row = []), (cur = '');
    } else cur += c;
  }
  if (cur || row.length) row.push(cur), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}

// Values stay strings; the profiler decides what they are for the whole column.
export const csvAdapter: DataAdapter = {
  id: 'csv',
  canHandle: (input) => typeof input === 'string' && !/^\s*[[{]/.test(input) && input.includes('\n'),
  parse: (input) => {
    const [head, ...body] = parseCSV(input as string);
    const keys = head.map((h, i) => h.trim() || `column${i + 1}`);
    return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] === undefined || r[i] === '' ? null : r[i]])));
  },
};

export const ADAPTERS: DataAdapter[] = [jsonAdapter, csvAdapter];

export function toRows(input: unknown, adapters = ADAPTERS): Row[] {
  const a = adapters.find((x) => x.canHandle(input));
  if (!a) throw new Error('No adapter can read this input');
  return a.parse(input);
}
