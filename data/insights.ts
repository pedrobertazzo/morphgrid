import { parseNumber, parseTime } from './profile';
import { isId, words } from './semantics';
import type { Entry, Field, Insight, MorphDataset, Point, Row, Trend } from './types';

// ---------- reading and formatting values ----------

export function num(r: Row, f: Field): number | null {
  return parseNumber(r[f.id]);
}

export function time(r: Row, f: Field): number | null {
  return f.time ? parseTime(r[f.id], f.time.source) : null;
}

export function cat(r: Row, f: Field): string | null {
  const v = r[f.id];
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

const nf = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return nf(v / 1e9, 1) + 'B';
  if (a >= 1e6) return nf(v / 1e6, 1) + 'M';
  if (a >= 1e4) return nf(v / 1e3, 1) + 'k';
  return nf(v, a >= 100 ? 0 : a >= 10 ? 1 : 2);
}

export function fmt(v: number, unit?: string): string {
  switch (unit) {
    case 'min':
      return v >= 120 ? `${compact(v / 60)} hrs` : `${nf(v)} min`;
    case '$':
    case '€':
      return (v < 0 ? '-' : '') + unit + compact(Math.abs(v));
    case '%':
      return `${nf(v, Math.abs(v) < 10 ? 1 : 0)}%`;
    case '°C':
      return `${nf(v, 1)}°C`;
    case undefined:
      return compact(v);
    default:
      return `${compact(v)} ${unit}`;
  }
}

const unitWord = (f: Field) => (f.unit === 'min' ? 'hours' : f.unit === '$' || f.unit === '€' ? f.unit : f.unit ?? '');

export const human = (f: Field) => {
  const w = words(f.id).join(' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
};
const lower = (f: Field) => words(f.id).join(' ');
const plural = (w: string) => (/[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's');

// ---------- aggregation ----------

type Acc = { sum: number; n: number };

function group(rows: Row[], key: (r: Row) => string | null, m: Field | null) {
  const out = new Map<string, Acc>();
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    const v = m ? num(r, m) : 1;
    if (v == null) continue;
    const a = out.get(k) ?? { sum: 0, n: 0 };
    a.sum += v;
    a.n++;
    out.set(k, a);
  }
  return out;
}

const value = (a: Acc, m: Field | null) => (m && m.agg === 'mean' ? a.sum / a.n : a.sum);

function overall(rows: Row[], m: Field) {
  const a = group(rows, () => '*', m).get('*') ?? { sum: 0, n: 0 };
  return a.n ? value(a, m) : 0;
}

const aggName = (m: Field | null) => (!m ? 'count' : m.agg === 'mean' ? 'average' : 'total');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

const cv = (f: Field) => (f.numeric && f.numeric.mean ? f.numeric.std / Math.abs(f.numeric.mean) : 0);

// ---------- time bins ----------

const DAY = 86400000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function binFor(span: number): Trend['bin'] {
  if (span <= 3 * DAY) return 'hour';
  if (span <= 120 * DAY) return 'day';
  if (span <= 6 * 365 * DAY) return 'month';
  return 'year';
}

function floor(t: number, bin: Trend['bin']) {
  const d = new Date(t);
  if (bin === 'hour') return Math.floor(t / 3600000) * 3600000;
  if (bin === 'day') return Math.floor(t / DAY) * DAY;
  if (bin === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Date.UTC(d.getUTCFullYear(), 0, 1);
}

function step(t: number, bin: Trend['bin']) {
  const d = new Date(t);
  if (bin === 'hour') return t + 3600000;
  if (bin === 'day') return t + DAY;
  if (bin === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
}

export function binLabel(t: number, bin: Trend['bin']) {
  const d = new Date(t);
  if (bin === 'year') return String(d.getUTCFullYear());
  if (bin === 'month') return `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
  if (bin === 'day') return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
}

// ---------- generators ----------

interface Ctx {
  rows: Row[];
  measures: Field[];
  dims: Field[];
  times: Field[];
  label?: Field;
  image?: Field;
  lat?: Field;
  lng?: Field;
  noun: string;
}

function context(ds: MorphDataset): Ctx {
  const by = (role: Field['role']) => ds.fields.filter((f) => f.role === role).sort((a, b) => b.confidence - a.confidence);
  const labels = by('label');
  return {
    rows: ds.rows,
    measures: by('measure').slice(0, 8),
    dims: by('dimension').filter((d) => d.distinct >= 2 && d.distinct <= 60),
    times: by('temporal'),
    label: labels.find((l) => /name|title|label/i.test(l.name)) ?? labels[0] ?? by('identifier').find((f) => f.physical === 'string'),
    image: by('image')[0],
    lat: by('lat')[0],
    lng: by('lng')[0],
    noun: 'rows',
  };
}

// The grouping that best splits a chart: few values, but more than one.
const colorDim = (c: Ctx, max = 8) => [...c.dims].filter((d) => d.distinct <= max).sort((a, b) => a.distinct - b.distinct)[0];

function top(c: Ctx, m: Field): Insight | null {
  // Ranking rows only says something when rows have names; "SO-10006 is first" doesn't.
  if (!c.label || c.label.role === 'identifier') return null;
  const rows = c.rows.filter((r) => num(r, m) != null).sort((a, b) => num(b, m)! - num(a, m)!);
  if (rows.length < 3) return null;
  const total = overall(c.rows, m);
  const lead = rows[0];
  const leadV = num(lead, m)!;
  const series: Entry[] = rows.slice(0, 8).map((r) => ({
    label: cat(r, c.label!) ?? '—',
    value: num(r, m)!,
    display: fmt(num(r, m)!, m.unit),
    image: c.image ? cat(r, c.image) : undefined,
  }));
  const name = cat(lead, c.label) ?? 'The top entry';
  const above = rows.filter((r) => num(r, m)! > total).length;
  return {
    key: `top:${m.id}`,
    title: human(m),
    kind: 'top',
    measureUnit: m.unit,
    value: total,
    display: fmt(total, m.unit),
    unit: `${aggName(m)} ${unitWord(m)}`.trim(),
    series,
    progress:
      m.agg === 'sum'
        ? { value: leadV, max: total || 1, label: `${name}: ${pct(leadV, total)}% of it` }
        : { value: above, max: rows.length, label: `${above} of ${rows.length} above average` },
    line:
      m.agg === 'sum'
        ? `${human(m)} adds up to ${fmt(total, m.unit)} across ${rows.length} ${c.noun}. ${name} leads with ${fmt(leadV, m.unit)}, ${pct(leadV, total)}% of the total.`
        : `The average ${lower(m)} is ${fmt(total, m.unit)}. ${name} is highest at ${fmt(leadV, m.unit)}; ${cat(rows[rows.length - 1], c.label)} lowest at ${fmt(num(rows[rows.length - 1], m)!, m.unit)}.`,
    image: c.image ? cat(lead, c.image) : undefined,
    score: 0.72 + 0.1 * m.confidence - 0.01 * c.measures.indexOf(m) - (cv(m) < 0.05 ? 0.3 : 0),
    explain: `${m.agg}(${m.id}), top rows by ${c.label.id}`,
    fields: [m.id, c.label.id],
  };
}

function breakdown(c: Ctx, d: Field, m: Field | null): Insight | null {
  const g = group(c.rows, (r) => cat(r, d), m);
  if (g.size < 2) return null;
  const all = [...g.entries()].map(([k, a]) => ({ label: k, value: value(a, m) })).sort((a, b) => b.value - a.value);
  const total = all.reduce((s, e) => s + e.value, 0);
  const shown = all.slice(0, all.length > 8 ? 7 : 8);
  const rest = all.slice(shown.length);
  const additive = !m || m.agg === 'sum';
  if (rest.length && additive) shown.push({ label: `${rest.length} others`, value: rest.reduce((s, e) => s + e.value, 0) });
  const unit = m?.unit;
  const series = shown.map((e) => ({ ...e, display: fmt(e.value, unit) }));
  const [hi, lo] = [all[0], all[all.length - 1]];
  const mean = total / all.length;
  const spread = Math.min(0.15, Math.sqrt(all.reduce((s, e) => s + (e.value - mean) ** 2, 0) / all.length) / (Math.abs(mean) || 1) / 4);
  const what = m ? lower(m) : lower(c.label ?? d).replace(/s?$/, 's');
  return {
    key: `breakdown:${d.id}:${m?.id ?? 'count'}`,
    title: m ? `${human(m)} by ${lower(d)}` : `${human(d)}`,
    kind: m ? 'breakdown' : 'count',
    measureUnit: unit,
    value: hi.value,
    display: fmt(hi.value, unit),
    unit: m ? `${aggName(m)} for ${hi.label}` : `${c.noun} are ${hi.label}`,
    series,
    progress: additive
      ? { value: hi.value, max: total || 1, label: `${hi.label}: ${pct(hi.value, total)}%` }
      : { value: hi.value - lo.value, max: Math.abs(hi.value) || 1, label: `${fmt(hi.value - lo.value, unit)} between top and bottom` },
    line: m
      ? `${hi.label} has the highest ${aggName(m)} ${what} at ${fmt(hi.value, unit)}; ${lo.label} the lowest at ${fmt(lo.value, unit)}.${additive ? ` ${hi.label} alone is ${pct(hi.value, total)}% of the total.` : ''}`
      : `${all.length} different ${lower(d)} values. ${hi.label} is the most common with ${fmt(hi.value)} ${c.noun} (${pct(hi.value, total)}%).`,
    score: (m ? 0.74 + 0.1 * m.confidence - 0.01 * c.measures.indexOf(m) : 0.5) + spread - (d.cardinality === 'low' ? 0 : 0.08),
    explain: m ? `${m.agg}(${m.id}) by ${d.id}` : `count by ${d.id}`,
    fields: m ? [d.id, m.id] : [d.id],
  };
}

function trend(c: Ctx, t: Field, m: Field | null): Insight | null {
  const pts = c.rows.map((r) => ({ r, t: time(r, t) })).filter((x) => x.t != null) as { r: Row; t: number }[];
  if (pts.length < 3) return null;
  const lo = Math.min(...pts.map((p) => p.t));
  const hi = Math.max(...pts.map((p) => p.t));
  let bin = binFor(hi - lo);
  const bins: number[] = [];
  for (let x = floor(lo, bin); x <= hi && bins.length < 400; x = step(x, bin)) bins.push(x);
  if (bins.length < 2) return null;
  const split = colorDim(c, 6);
  const groups = split ? [...group(c.rows, (r) => cat(r, split), null).keys()] : ['all'];
  const idx = new Map(bins.map((b, i) => [b, i]));
  const accs = groups.map(() => bins.map(() => ({ sum: 0, n: 0 })));
  for (const { r, t: at } of pts) {
    const gi = split ? groups.indexOf(cat(r, split) ?? '') : 0;
    const v = m ? num(r, m) : 1;
    if (gi < 0 || v == null) continue;
    const a = accs[gi][idx.get(floor(at, bin))!];
    a.sum += v;
    a.n++;
  }
  const additive = !m || m.agg === 'sum';
  const lines = groups.map((name, gi) => ({
    name,
    values: accs[gi].map((a) => (a.n ? value(a, m) : additive ? 0 : null)),
  }));
  const totals = bins.map((_, i) => {
    const vs = accs.map((g) => g[i]).filter((a) => a.n);
    const s = vs.reduce((x, a) => x + a.sum, 0);
    const n = vs.reduce((x, a) => x + a.n, 0);
    return n ? (additive ? s : s / n) : additive ? 0 : null;
  });
  const valid = totals.map((v, i) => ({ v, i })).filter((x) => x.v != null) as { v: number; i: number }[];
  const peak = valid.reduce((a, b) => (b.v > a.v ? b : a));
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const unit = m?.unit;
  const change = prev && prev.v ? Math.round(((last.v - prev.v) / Math.abs(prev.v)) * 100) : 0;
  const what = m ? lower(m) : `${c.noun}`;
  return {
    key: `trend:${t.id}:${m?.id ?? 'count'}`,
    title: m ? `${human(m)} over time` : `${human(t)} by ${bin}`,
    kind: 'trend',
    measureUnit: unit,
    value: last.v,
    display: fmt(last.v, unit),
    unit: `${m ? aggName(m) : c.noun} in ${binLabel(bins[last.i], bin)}`,
    series: valid.slice(-8).map(({ v, i }) => ({ label: binLabel(bins[i], bin), value: v, display: fmt(v, unit) })),
    trend: { bin, t: bins, lines },
    progress: { value: last.v, max: peak.v || 1, label: `${pct(last.v, peak.v)}% of the ${binLabel(bins[peak.i], bin)} peak` },
    line:
      `${m ? `${aggName(m).replace(/^./, (s) => s.toUpperCase())} ${what}` : `${human(t)}`} peaked in ${binLabel(bins[peak.i], bin)} at ${fmt(peak.v, unit)}${m ? '' : ` ${c.noun}`}.` +
      (prev ? ` ${binLabel(bins[last.i], bin)}: ${fmt(last.v, unit)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the ${bin} before.` : '') +
      (split ? ` Split by ${lower(split)}.` : ''),
    score: (m ? 0.86 + 0.08 * m.confidence - 0.01 * c.measures.indexOf(m) : 0.58) * t.confidence + (split ? 0.02 : 0),
    explain: `${m ? `${m.agg}(${m.id})` : 'count'} per ${bin} of ${t.id}${split ? ` by ${split.id}` : ''}`,
    fields: [t.id, ...(m ? [m.id] : []), ...(split ? [split.id] : [])],
  };
}

function sample<T>(xs: T[], n: number) {
  if (xs.length <= n) return xs;
  const s = xs.length / n;
  return Array.from({ length: n }, (_, i) => xs[Math.floor(i * s)]);
}

function relation(c: Ctx, x: Field, y: Field): Insight | null {
  const rows = c.rows.filter((r) => num(r, x) != null && num(r, y) != null);
  if (rows.length < 5) return null;
  const r = pearson(rows.map((q) => num(q, x)!), rows.map((q) => num(q, y)!));
  const size = c.measures.filter((m) => m !== x && m !== y).sort((a, b) => cv(b) - cv(a))[0];
  const g = colorDim(c);
  const data: Point[] = sample(rows, 400).map((q) => ({
    x: num(q, x)!,
    y: num(q, y)!,
    size: size ? num(q, size) ?? undefined : undefined,
    group: g ? cat(q, g) ?? undefined : undefined,
    label: c.label ? cat(q, c.label) ?? undefined : undefined,
  }));
  // Series facet: mean y across x quintiles, so the item still reads as bars or a list.
  const xs = rows.map((q) => num(q, x)!).sort((a, b) => a - b);
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => xs[Math.floor(p * (xs.length - 1))]);
  const bucket = (v: number) => cuts.filter((k) => v > k).length;
  const qs = Array.from({ length: 5 }, () => ({ sum: 0, n: 0 }));
  for (const q of rows) {
    const a = qs[bucket(num(q, x)!)];
    a.sum += num(q, y)!;
    a.n++;
  }
  const names = ['Lowest', 'Low', 'Middle', 'High', 'Highest'];
  const series = qs
    .map((a, i) => ({ label: `${names[i]} ${lower(x)}`, value: a.n ? a.sum / a.n : 0, display: a.n ? fmt(a.sum / a.n, y.unit) : '—' }))
    .filter((_, i) => qs[i].n);
  const strength = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : Math.abs(r) > 0.2 ? 'weak' : 'no clear';
  return {
    key: `relation:${x.id}:${y.id}`,
    title: `${human(y)} vs ${lower(x)}`,
    kind: 'relation',
    value: r,
    display: r.toFixed(2),
    unit: 'correlation',
    series,
    points: { x: human(x), y: human(y), size: size && human(size), group: g && human(g), data },
    progress: { value: Math.abs(r), max: 1, label: `${strength} ${r >= 0 ? 'positive' : 'negative'} link` },
    line:
      strength === 'no clear'
        ? `${human(y)} doesn't track ${lower(x)} (r = ${r.toFixed(2)}).`
        : `Higher ${lower(x)} goes with ${r > 0 ? 'higher' : 'lower'} ${lower(y)}: a ${strength} link (r = ${r.toFixed(2)}) across ${rows.length} ${c.noun}.`,
    score: 0.45 + 0.4 * Math.abs(r) - (Math.abs(r) > 0.97 ? 0.3 : 0) + (g ? 0.03 : 0),
    explain: `${x.id} → x, ${y.id} → y${size ? `, ${size.id} → size` : ''}${g ? `, ${g.id} → color` : ''}`,
    fields: [x.id, y.id],
  };
}

function geo(c: Ctx): Insight | null {
  if (!c.lat || !c.lng) return null;
  const m = c.measures[0];
  const g = colorDim(c);
  const rows = c.rows.filter((r) => num(r, c.lat!) != null && num(r, c.lng!) != null);
  if (rows.length < 2) return null;
  const by = g && breakdown(c, g, null);
  return {
    key: 'geo',
    title: 'Where',
    kind: 'geo',
    value: rows.length,
    display: compact(rows.length),
    unit: `${c.noun} with a location`,
    series: by?.series ?? [],
    points: {
      x: 'Longitude', y: 'Latitude', size: m && human(m), group: g && human(g), geo: true,
      data: sample(rows, 600).map((r) => ({ x: num(r, c.lng!)!, y: num(r, c.lat!)!, size: m ? num(r, m) ?? undefined : undefined, group: g ? cat(r, g) ?? undefined : undefined, label: c.label ? cat(r, c.label) ?? undefined : undefined })),
    },
    line: `${rows.length} ${c.noun} have coordinates${m ? `; dot size shows ${lower(m)}` : ''}${g ? `, color shows ${lower(g)}` : ''}.`,
    score: 0.88,
    explain: `${c.lng.id} → x, ${c.lat.id} → y${m ? `, ${m.id} → size` : ''}${g ? `, ${g.id} → color` : ''}`,
    fields: [c.lat.id, c.lng.id],
  };
}

function records(c: Ctx): Insight {
  const g = colorDim(c, 12);
  const by = g && breakdown(c, g, null);
  return {
    key: 'records',
    title: 'Records',
    kind: 'count',
    value: c.rows.length,
    display: compact(c.rows.length),
    unit: c.noun,
    series: by?.series ?? [],
    line: `${compact(c.rows.length)} ${c.noun}${g ? ` across ${g.distinct} ${lower(g)} values` : ''}.`,
    score: 0.35,
    explain: 'row count',
    fields: [],
  };
}

export function generate(ds: MorphDataset): Insight[] {
  const c = context(ds);
  if (c.label) c.noun = plural(words(c.label.id).filter((w) => !isId(w)).pop() ?? 'row');
  const out: (Insight | null)[] = [records(c), geo(c)];
  for (const m of c.measures) out.push(top(c, m));
  for (const d of c.dims) {
    out.push(breakdown(c, d, null));
    for (const m of c.measures) out.push(breakdown(c, d, m));
  }
  for (const t of c.times) {
    out.push(trend(c, t, null));
    for (const m of c.measures) out.push(trend(c, t, m));
  }
  for (let i = 0; i < c.measures.length; i++)
    for (let j = i + 1; j < c.measures.length; j++) out.push(relation(c, c.measures[i], c.measures[j]));
  return (out.filter(Boolean) as Insight[]).sort((a, b) => b.score - a.score);
}

// Greedy pick that keeps the grid varied: reusing a field or a kind costs score.
export function pick(insights: Insight[], n: number): Insight[] {
  const chosen: Insight[] = [];
  const used = new Map<string, number>();
  const kinds = new Map<string, number>();
  const left = [...insights];
  while (chosen.length < n && left.length) {
    const adj = (i: Insight) =>
      i.score - 0.1 * i.fields.reduce((s, f) => s + (used.get(f) ?? 0), 0) - 0.12 * (kinds.get(i.kind) ?? 0);
    left.sort((a, b) => adj(b) - adj(a));
    const next = left.shift()!;
    chosen.push(next);
    next.fields.forEach((f) => used.set(f, (used.get(f) ?? 0) + 1));
    kinds.set(next.kind, (kinds.get(next.kind) ?? 0) + 1);
  }
  return chosen;
}
