import { describe, expect, it } from 'vitest';
import { fillRows, findRow, pruneRows, rowCells, rowHeadId, rowItems, rowLayout, rowSlotId, type Row } from '../src/rows';

const rows: Row[] = [
  { id: 'a', view: 'number', slots: 4 },
  { id: 'b', view: 'line', slots: 2 },
];

describe('rows', () => {
  it('makes a locked header cell and one cell per slot, all showing the row view', () => {
    const cells = rowCells(rows);
    expect(cells.map((c) => c.id)).toEqual(['a-h', 'a-0', 'a-1', 'a-2', 'a-3', 'b-h', 'b-0', 'b-1']);
    expect(cells.filter((c) => c.locked).map((c) => c.id)).toEqual(['a-h', 'b-h']);
    expect(new Set(cells.filter((c) => c.id.startsWith('b')).map((c) => c.view))).toEqual(new Set(['line']));
  });

  it('lays out a full-width header line, then the slots side by side', () => {
    const l = rowLayout(rows, { height: (v) => (v === 'number' ? 120 : 220) });
    expect(l.templateAreas![0]).toBe(Array(12).fill('a-h').join(' '));
    expect(l.templateAreas![1]).toBe(['a-0', 'a-1', 'a-2', 'a-3'].flatMap((id) => Array(3).fill(id)).join(' '));
    expect(l.templateAreas![3]).toBe([...Array(6).fill('b-0'), ...Array(6).fill('b-1')].join(' '));
    expect(l.rows).toBe('auto 120px auto 220px');
  });

  it('wraps slots on narrow screens, per view', () => {
    const l = rowLayout(rows, { narrow: { perLine: (v) => (v === 'number' ? 2 : 1) } });
    expect(l.breakpoints![0].templateAreas).toEqual(['a-h a-h', 'a-0 a-1', 'a-2 a-3', 'b-h b-h', 'b-0 b-0', 'b-1 b-1']);
    expect(rowLayout(rows, { narrow: false }).breakpoints).toBeUndefined();
  });

  it('gives uneven slot counts the leftover columns', () => {
    const l = rowLayout([{ id: 'c', view: 'x', slots: 5 }], { narrow: false });
    expect(l.templateAreas![1].split(' ').filter((n) => n === 'c-4')).toHaveLength(4);
  });

  it('finds rows and slots from cell ids', () => {
    expect(findRow(rows, 'b-1')).toMatchObject({ index: 1, slot: 1 });
    expect(findRow(rows, 'a-h')).toMatchObject({ index: 0, slot: null });
    expect(findRow(rows, 'z-0')).toBeNull();
  });

  it('round-trips items through fillRows and rowItems', () => {
    const items = [['x', null, 'y', null], ['z', null]];
    const a = fillRows(rows, items);
    expect(a[rowHeadId(rows[0])]).toBeNull();
    expect(a[rowSlotId(rows[1], 0)]).toBe('z');
    expect(rowItems(rows, a)).toEqual(items);
  });

  it('prunes items from slots that no longer exist', () => {
    const a = fillRows(rows, [['x', 'y', 'z', 'w'], ['v', 'u']]);
    const fewer = [{ ...rows[0], slots: 2 }, rows[1]];
    const p = pruneRows(a, fewer, ['x', 'y', 'z', 'w', 'v', 'u']);
    expect(Object.values(p).filter(Boolean)).toEqual(['x', 'y', 'v', 'u']);
    expect('a-2' in p).toBe(false);
  });
});
