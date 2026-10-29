import { describe, expect, test } from 'vitest';
import { analyze, autoRows, cacheKey, CHAINS, fits, refine, resolve, summarize, toRows, VIEW_KEYS, type Field } from '../data';
import { rowHeadId as headId, rowSlotId as slotId } from '../src/rows';
import { CORPUS } from '../data/corpus';

const roles = (input: unknown) => Object.fromEntries(analyze(input).dataset.fields.map((f) => [f.id, f.role]));
const field = (input: unknown, id: string) => analyze(input).dataset.fields.find((f) => f.id === id)!;
const data = (id: string) => CORPUS.find((d) => d.id === id)!.data;

describe('adapters', () => {
  test('unwraps nested API envelopes', () => {
    expect(toRows({ response: { count: 2, items: [{ a: 1 }, { a: 2 }] } })).toHaveLength(2);
  });
  test('flattens nested objects into dotted fields', () => {
    expect(toRows([{ loc: { lat: 1, lng: 2 } }])[0]).toEqual({ 'loc.lat': 1, 'loc.lng': 2 });
  });
  test('parses CSV with quotes and semicolons', () => {
    expect(toRows('a;b\n"x;y";2\n')).toEqual([{ a: 'x;y', b: '2' }]);
  });
});

describe('semantics without domain code', () => {
  test('steam: ids, epoch seconds with 0 for never, images, labels', () => {
    const r = roles(data('steam'));
    expect(r).toMatchObject({ appid: 'identifier', name: 'label', rtime_last_played: 'temporal', img_header: 'image', playtime_forever: 'measure', 'achievements.earned': 'measure' });
  });
  test('iot: the success example from the plan', () => {
    const r = roles(data('iot'));
    expect(r).toMatchObject({ measurement_time: 'temporal', device: 'dimension', temperature: 'measure', pressure: 'measure', 'location.lat': 'lat', 'location.lng': 'lng' });
    expect(field(data('iot'), 'temperature').agg).toBe('mean');
  });
  test('sales: day-first dates, additive revenue, non-additive percentages', () => {
    expect(field(data('sales'), 'order_date').time?.source).toBe('dmy');
    expect(field(data('sales'), 'revenue')).toMatchObject({ agg: 'sum', unit: '$' });
    expect(field(data('sales'), 'discount_pct')).toMatchObject({ agg: 'mean', unit: '%' });
    expect(roles(data('sales')).order_id).toBe('identifier');
  });
  test('weather CSV: text columns become numbers and dates; temp_min is not minutes', () => {
    const r = roles(data('weather'));
    expect(r).toMatchObject({ date: 'temporal', city: 'dimension', temp_max: 'measure', rainfall_mm: 'measure' });
    expect(field(data('weather'), 'temp_min').unit).toBe('°C');
  });
  test('employees: booleans are dimensions, salary is averaged', () => {
    expect(roles(data('employees'))).toMatchObject({ remote: 'dimension', employee_id: 'identifier', name: 'label' });
    expect(field(data('employees'), 'salary').agg).toBe('mean');
  });
});

describe('insights and grid', () => {
  test('iot produces temperature over time split by device, and a geo view', () => {
    const { insights } = analyze(data('iot'));
    const t = insights.find((i) => i.key === 'trend:measurement_time:temperature')!;
    expect(t.trend!.lines.map((l) => l.name).sort()).toEqual(['greenhouse-a', 'greenhouse-b', 'rooftop', 'warehouse']);
    expect(insights.find((i) => i.kind === 'geo')?.points?.geo).toBe(true);
  });
  test('every corpus dataset gets a board of typed rows whose data fits natively', () => {
    for (const d of CORPUS) {
      const { insights } = analyze(d.data);
      const { rows, value } = autoRows(insights);
      expect(rows[0].view, d.id).toBe('number');
      expect(new Set(rows.map((r) => r.view)).size, d.id).toBe(rows.length);
      for (const r of rows) {
        expect(value[headId(r)]).toBeNull();
        for (let k = 0; k < r.slots; k++) {
          const key = value[slotId(r, k)];
          if (key) expect(resolve(insights.find((i) => i.key === key)!, r.view).fallback, `${d.id}/${r.view}`).toBe(false);
        }
      }
      for (const r of rows) for (let k = 0; k < r.slots; k++) expect(value[slotId(r, k)], `${d.id}: no empty starting slots`).toBeTruthy();
      const placed = Object.values(value).filter(Boolean);
      expect(new Set(placed).size).toBe(placed.length);
    }
  });
  test('any card in any cell resolves to a view it can draw', () => {
    for (const d of CORPUS)
      for (const i of analyze(d.data).insights)
        for (const v of VIEW_KEYS) {
          const r = resolve(i, v);
          expect(fits(i, r.view), `${i.key} in ${v}`).toBe(true);
          expect(CHAINS[v]).toContain(r.view);
          expect(r.fallback).toBe(r.view !== v);
          if (r.fallback) expect(r.reason).toBeTruthy();
        }
  });
  test('a breakdown dropped on a scatter cell becomes dots; on a line cell, bars', () => {
    const b = analyze(data('sales')).insights.find((i) => i.key === 'breakdown:product:revenue')!;
    expect(resolve(b, 'scatter')).toEqual({ view: 'dots', fallback: true, reason: 'no x/y pairs' });
    expect(resolve(b, 'line')).toEqual({ view: 'bars', fallback: true, reason: 'no time series' });
  });
  test('every insight can morph into a number and a sentence', () => {
    for (const d of CORPUS) for (const i of analyze(d.data).insights) expect(fits(i, 'number') && fits(i, 'text')).toBe(true);
  });
  test('no top lists ranked by bare ids', () => {
    expect(analyze(data('sales')).insights.some((i) => i.kind === 'top')).toBe(false);
  });
});

describe('optional refinement', () => {
  test('sends names and stats only, caches by schema, and only overrides with higher confidence', async () => {
    const { dataset } = analyze(data('steam'));
    const s = summarize(dataset.fields, dataset.rows.length);
    expect(JSON.stringify(s)).not.toContain('Baldur');
    let calls = 0;
    const provider = async () => (calls++, [{ fieldId: 'playtime_forever', unit: 'min', confidence: 0.97 }, { fieldId: 'name', role: 'text' as const, confidence: 0.1 }]);
    const a: Field[] = await refine(dataset.fields, dataset.rows.length, provider);
    await refine(dataset.fields, dataset.rows.length, provider);
    expect(calls).toBe(1);
    expect(a.find((f) => f.id === 'playtime_forever')!.unit).toBe('min');
    expect(a.find((f) => f.id === 'name')!.role).toBe('label');
    expect(cacheKey(s)).toBe(cacheKey(summarize(dataset.fields, 999)));
  });
});
