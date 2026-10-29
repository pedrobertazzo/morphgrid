import type { Agg, Field, FieldProfile, Role, TimeSource } from './types';

export const words = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const has = (w: string[], set: string[]) => w.find((x) => set.includes(x));

const ID = ['id', 'uuid', 'guid', 'sku', 'appid', 'key', 'code'];
const TIME = ['time', 'date', 'timestamp', 'ts', 'at', 'played', 'created', 'updated', 'when', 'epoch', 'day', 'datetime'];
const LAT = ['lat', 'latitude'];
const LNG = ['lng', 'lon', 'long', 'longitude'];
const LABEL = ['name', 'title', 'label', 'game', 'product', 'player', 'team', 'city', 'station'];
const PLACE = ['city', 'country', 'location', 'region', 'state', 'place', 'site', 'address'];
const IMAGE = ['image', 'img', 'poster', 'avatar', 'photo', 'thumbnail', 'logo', 'icon', 'picture', 'cover'];
const NON_ADDITIVE = ['rate', 'ratio', 'pct', 'percent', 'percentage', 'avg', 'average', 'mean', 'median', 'temperature', 'temp', 'score', 'rating', 'price', 'age', 'level', 'pressure', 'humidity', 'speed', 'pace', 'lat', 'lng', 'index', 'rank', 'probability', 'density', 'bpm', 'cadence', 'salary', 'tenure', 'latency', 'voltage', 'battery', 'margin'];
const ADDITIVE = ['count', 'total', 'amount', 'revenue', 'sales', 'qty', 'quantity', 'units', 'hours', 'minutes', 'min', 'playtime', 'duration', 'cost', 'spend', 'views', 'clicks', 'downloads', 'earned', 'sessions', 'orders', 'profit', 'distance', 'calories', 'steps', 'goals', 'points', 'assists', 'kills', 'wins', 'losses', 'population', 'rainfall', 'precipitation'];

// Order matters: "temp_min" is a temperature, not minutes.
const UNITS: [string[], string][] = [
  [['temperature', 'temp', 'celsius'], '°C'],
  [['min', 'mins', 'minutes'], 'min'],
  [['h', 'hr', 'hrs', 'hours'], 'h'],
  [['sec', 'secs', 'seconds'], 's'],
  [['ms', 'latency'], 'ms'],
  [['pct', 'percent', 'percentage', 'humidity', 'margin'], '%'],
  [['usd', 'price', 'revenue', 'cost', 'salary', 'amount', 'sales', 'spend', 'income', 'profit'], '$'],
  [['eur'], '€'],
  [['km'], 'km'],
  [['kg'], 'kg'],
  [['kwh'], 'kWh'],
  [['km2', 'sqkm'], 'km²'],
  [['pressure'], 'hPa'],
  [['rainfall', 'precipitation', 'mm'], 'mm'],
];

const URL = /^https?:\/\//i;
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

type Rule = { role: Role; confidence: number; reason: string; time?: FieldProfile['time']; concept?: string };

function numericTime(p: FieldProfile, w: string[]): FieldProfile['time'] | undefined {
  const n = p.numeric!;
  const hinted = !!has(w, TIME);
  const lo = n.min === 0 && hinted ? n.minPositive : n.min;
  const span = (source: TimeSource, f: number) => ({ min: lo * f, max: n.max * f, source });
  if (lo >= 9.4e11 && n.max <= 5e12) return span('epoch-ms', 1);
  if (hinted && lo >= 9.4e8 && n.max <= 5e9) return span('epoch-s', 1000);
  if (n.integer && n.min >= 1900 && n.max <= 2100 && w.includes('year'))
    return { min: Date.UTC(n.min, 0, 1), max: Date.UTC(n.max, 0, 1), source: 'year' };
  return undefined;
}

function classify(p: FieldProfile): Rule {
  const w = words(p.name);
  const s = p.samples.map(String);
  switch (p.physical) {
    case 'null':
      return { role: 'ignore', confidence: 1, reason: 'always empty' };
    case 'array':
    case 'object':
      return { role: 'ignore', confidence: 0.9, reason: `nested ${p.physical}; not summarized yet` };
    case 'boolean':
      return { role: 'dimension', confidence: 0.9, reason: 'yes/no values' };
    case 'date':
      return { role: 'temporal', confidence: 0.95, reason: `${p.time!.source} dates` };
  }
  if (p.physical === 'number') {
    const n = p.numeric!;
    if (has(w, LAT) && n.min >= -90 && n.max <= 90) return { role: 'lat', confidence: 0.95, reason: 'named latitude, in range' };
    if (has(w, LNG) && n.min >= -180 && n.max <= 180) return { role: 'lng', confidence: 0.95, reason: 'named longitude, in range' };
    if (has(w, ID) && !has(w, ADDITIVE)) return { role: 'identifier', confidence: 0.9, reason: `name ends in "${has(w, ID)}"` };
    const time = numericTime(p, w);
    if (time)
      return { role: 'temporal', confidence: has(w, TIME) ? 0.9 : 0.65, reason: `numbers in ${time.source} range${has(w, TIME) ? ` and name says "${has(w, TIME)}"` : ''}`, time };
    if (n.integer && n.min >= 0 && n.max <= 1 && p.distinct <= 2) return { role: 'dimension', confidence: 0.7, reason: '0/1 flag' };
    const concept = has(w, ADDITIVE) ?? has(w, NON_ADDITIVE);
    return { role: 'measure', confidence: concept ? 0.9 : 0.6, reason: concept ? `numeric, concept "${concept}"` : 'numeric, meaning unknown', concept };
  }
  // strings
  if (s.length && s.every((v) => URL.test(v))) {
    const img = s.every((v) => IMG_EXT.test(v)) || !!has(w, IMAGE);
    return { role: img ? 'image' : 'url', confidence: 0.95, reason: img ? 'image links' : 'web links' };
  }
  if (has(w, ID) || (s.length && s.every((v) => UUID.test(v)))) return { role: 'identifier', confidence: 0.85, reason: 'id-like name or values' };
  if ((p.avgLength ?? 0) > 60) return { role: 'text', confidence: 0.8, reason: 'long free text' };
  const place = has(w, PLACE);
  if (p.cardinality === 'low' || p.cardinality === 'medium')
    return {
      role: 'dimension',
      confidence: 0.85,
      reason: `${p.distinct} repeated values${place ? '; place names need geocoding before a map' : ''}`,
      concept: place,
    };
  return { role: 'label', confidence: has(w, LABEL) ? 0.9 : 0.7, reason: 'mostly unique short text' };
}

function unitOf(p: FieldProfile, w: string[]): string | undefined {
  const s = p.samples.filter((v) => typeof v === 'string') as string[];
  if (s.some((v) => v.includes('%'))) return '%';
  if (s.some((v) => /[$€£]/.test(v))) return s[0].match(/[$€£]/)![0];
  for (const [keys, unit] of UNITS) if (has(w, keys)) return unit;
  return undefined;
}

export function isId(name: string) {
  return !!has(words(name), ID);
}

function aggOf(p: FieldProfile, w: string[], unit?: string): [Agg, string] {
  const na = has(w, NON_ADDITIVE);
  if (na) return ['mean', `"${na}" is not additive`];
  const ad = has(w, ADDITIVE);
  if (ad) return ['sum', `"${ad}" adds up`];
  if (unit === '%') return ['mean', 'percentages are not additive'];
  if (p.numeric?.integer && p.numeric.min >= 0) return ['sum', 'non-negative counts assumed additive'];
  return ['mean', 'unknown measure averaged'];
}

export function infer(profiles: FieldProfile[]): Field[] {
  return profiles.map((p) => {
    const r = classify(p);
    const w = words(p.name);
    const f: Field = { ...p, role: r.role, confidence: r.confidence, reasons: [r.reason], agg: 'sum', concept: r.concept };
    if (r.time) f.time = r.time;
    if (f.role === 'measure') {
      f.unit = unitOf(p, w);
      const [agg, why] = aggOf(p, w, f.unit);
      f.agg = agg;
      f.reasons.push(why);
      if (p.numeric && p.numeric.std === 0) (f.role = 'ignore'), f.reasons.push('constant value');
    }
    if (p.nulls / p.count > 0.8 && f.role !== 'ignore') (f.confidence *= 0.5), f.reasons.push('mostly empty');
    return f;
  });
}

// ---- Optional semantic refinement (LLM or anything else) ----

export interface SemanticHint {
  fieldId: string;
  role?: Role;
  concept?: string;
  unit?: string;
  agg?: Agg;
  confidence: number;
}

export type SemanticProvider = (summary: SchemaSummary) => Promise<SemanticHint[]>;

export interface SchemaSummary {
  rows: number;
  fields: { id: string; type: string; role: Role; distinct: number; nulls: number; range?: [number, number]; samples?: unknown[] }[];
}

// What may leave the machine: names and statistics. Sample values only when explicitly allowed.
export function summarize(fields: Field[], rows: number, withSamples = false): SchemaSummary {
  return {
    rows,
    fields: fields.map((f) => ({
      id: f.id,
      type: f.physical,
      role: f.role,
      distinct: f.distinct,
      nulls: f.nulls,
      range: f.numeric ? [f.numeric.min, f.numeric.max] : undefined,
      samples: withSamples ? f.samples.slice(0, 3) : undefined,
    })),
  };
}

export function cacheKey(s: SchemaSummary): string {
  const text = JSON.stringify(s.fields.map((f) => [f.id, f.type, f.role]));
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const cache = new Map<string, SemanticHint[]>();

export async function refine(
  fields: Field[],
  rows: number,
  provider: SemanticProvider,
  opts: { threshold?: number; withSamples?: boolean } = {},
): Promise<Field[]> {
  const threshold = opts.threshold ?? 0.75;
  if (!fields.some((f) => f.confidence < threshold)) return fields;
  const summary = summarize(fields, rows, opts.withSamples);
  const key = cacheKey(summary);
  const hints = cache.get(key) ?? (await provider(summary));
  cache.set(key, hints);
  return fields.map((f) => {
    const h = hints.find((x) => x.fieldId === f.id);
    if (!h || h.confidence <= f.confidence) return f;
    return { ...f, ...h, reasons: [...f.reasons, `refined (${Math.round(h.confidence * 100)}%)`] };
  });
}
