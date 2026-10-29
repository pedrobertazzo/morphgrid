import type { FieldProfile, PhysicalType, Row, TimeSource } from './types';

const ISO = /^\d{4}-\d{2}(-\d{2})?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const NUM = /^[-+]?[$€£]?\s?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?(e[-+]?\d+)?\s?%?$/i;
const BOOL = new Set(['true', 'false', 'yes', 'no']);

export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || !NUM.test(s) || !/\d/.test(s)) return null;
  const n = Number(s.replace(/[$€£,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseTime(v: unknown, source: TimeSource): number | null {
  if (v == null) return null;
  if (source === 'iso') return typeof v === 'string' && ISO.test(v.trim()) ? Date.parse(v.trim()) : null;
  if (source === 'dmy' || source === 'mdy') {
    const m = typeof v === 'string' ? SLASH.exec(v.trim()) : null;
    if (!m) return null;
    const [a, b] = source === 'dmy' ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return Date.UTC(+m[3], a - 1, b);
  }
  const n = parseNumber(v);
  // APIs often store "never" as 0 in epoch fields.
  if (n == null || (n === 0 && source !== 'year')) return null;
  return source === 'epoch-ms' ? n : source === 'epoch-s' ? n * 1000 : Date.UTC(n, 0, 1);
}

function kindOf(v: unknown): PhysicalType {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  const s = String(v).trim();
  if (ISO.test(s) || SLASH.test(s)) return 'date';
  if (parseNumber(s) != null) return 'number';
  if (BOOL.has(s.toLowerCase())) return 'boolean';
  return 'string';
}

function dateSource(values: string[]): TimeSource {
  if (values.every((v) => ISO.test(v.trim()))) return 'iso';
  const m = values.map((v) => SLASH.exec(v.trim())).filter(Boolean) as RegExpExecArray[];
  return m.some((x) => +x[1] > 12) ? 'dmy' : 'mdy';
}

function cardinality(distinct: number, n: number): FieldProfile['cardinality'] {
  if (n >= 8 && distinct === n) return 'unique';
  if (distinct <= 8) return 'low';
  if (distinct <= 30 || distinct / n <= 0.3) return 'medium';
  return 'high';
}

export function profileField(rows: Row[], id: string): FieldProfile {
  const raw = rows.map((r) => r[id]);
  const present = raw.filter((v) => kindOf(v) !== 'null');
  const kinds = new Map<PhysicalType, number>();
  for (const v of present) kinds.set(kindOf(v), (kinds.get(kindOf(v)) ?? 0) + 1);
  const [top] = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
  // A column is a number/date only when nearly all of it parses that way; otherwise it's text.
  let physical: PhysicalType = !top ? 'null' : top[1] / present.length >= 0.9 ? top[0] : 'string';
  const distinct = new Set(present.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))).size;
  const p: FieldProfile = {
    id,
    name: id.split('.').pop()!,
    physical,
    count: rows.length,
    nulls: rows.length - present.length,
    distinct,
    cardinality: cardinality(distinct, present.length),
    samples: present.slice(0, 5),
  };
  if (physical === 'number') {
    const nums = present.map(parseNumber).filter((n): n is number => n != null);
    const mean = nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
    const std = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length || 1));
    let min = Infinity, max = -Infinity, minPositive = Infinity;
    for (const n of nums) (min = Math.min(min, n)), (max = Math.max(max, n)), n > 0 && (minPositive = Math.min(minPositive, n));
    p.numeric = { min, max, minPositive, mean, std, integer: nums.every(Number.isInteger) };
  } else if (physical === 'date') {
    const source = dateSource(present.map(String));
    const ts = present.map((v) => parseTime(v, source)).filter((t): t is number => t != null);
    p.time = { min: Math.min(...ts), max: Math.max(...ts), source };
  } else if (physical === 'string') {
    p.avgLength = present.reduce((a: number, v) => a + String(v).length, 0) / (present.length || 1);
  }
  return p;
}

export function profile(rows: Row[]): FieldProfile[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(0, 500)) for (const k in r) if (!seen.has(k)) seen.add(k), ids.push(k);
  return ids.map((id) => profileField(rows, id));
}
