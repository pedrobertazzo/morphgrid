import { describe, expect, it } from 'vitest';
import {
  allRows, freshId, moveRow, moveSection, placeRow, placeSection, resolveLayout, sectionCells, sectionLayout, shrinkRow,
  type Section,
} from '../src';

const secs: Section[] = [
  { id: 's0', title: 'Top', rows: [{ id: 'a', view: 'number', slots: 2 }, { id: 'b', view: 'line', slots: 1 }] },
  { id: 's1', title: 'More', rows: [{ id: 'c', view: 'bars', slots: 3 }] },
];
const ids = (s: Section[]) => s.map((x) => `${x.id}:${x.rows.map((r) => r.id).join('')}`).join(' ');

describe('shrinkRow', () => {
  it('drops empty slots before items, right-most empty first', () => {
    expect(shrinkRow(['a', null, 'b', null], 3)).toEqual(['a', null, 'b']);
    expect(shrinkRow(['a', null, 'b', null], 2)).toEqual(['a', 'b']);
    expect(shrinkRow([null, 'a', 'b'], 2)).toEqual(['a', 'b']);
  });
  it('only drops items from the end once no empty slot is left', () => {
    expect(shrinkRow(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    expect(shrinkRow(['a', null, 'b', 'c'], 2)).toEqual(['a', 'b']);
  });
});

describe('sections', () => {
  it('adds a locked header cell per section before its rows', () => {
    const cells = sectionCells(secs);
    expect(cells.map((c) => c.id)).toEqual(['s0-s', 'a-h', 'a-0', 'a-1', 'b-h', 'b-0', 's1-s', 'c-h', 'c-0', 'c-1', 'c-2']);
    expect(cells[0].locked).toBe(true);
  });

  it('lays sections out with a spacer line between them and bands over their lines', () => {
    const l = sectionLayout(secs, { columns: 4, height: 100, sectionSpace: 24 });
    expect(l.templateAreas).toEqual([
      's0-s s0-s s0-s s0-s',
      'a-h a-h a-h a-h',
      'a-0 a-0 a-1 a-1',
      'b-h b-h b-h b-h',
      'b-0 b-0 b-0 b-0',
      '. . . .',
      's1-s s1-s s1-s s1-s',
      'c-h c-h c-h c-h',
      'c-0 c-1 c-2 c-2',
    ]);
    expect(l.rows).toBe('auto auto 100px auto 100px 24px auto auto 100px');
    expect(l.bands).toEqual({ 'row:a': '2 / 4', 'row:b': '4 / 6', 'section:s0': '1 / 6', 'row:c': '8 / 10', 'section:s1': '7 / 10' });
    // The narrow breakpoint stacks slots, so its bands differ, and resolveLayout swaps them in.
    expect(resolveLayout(l, 500).bands!['section:s1']).toBe('8 / 13');
  });

  it('moves rows within and across sections', () => {
    expect(ids(moveRow(secs, 'a', 1))).toBe('s0:ba s1:c');
    expect(ids(moveRow(secs, 'b', 1))).toBe('s0:a s1:bc');
    expect(ids(moveRow(secs, 'c', -1))).toBe('s0:abc s1:');
    expect(moveRow(secs, 'a', -1)).toBe(secs);
    expect(ids(placeRow(secs, 'a', { section: 1, index: 1 }))).toBe('s0:b s1:ca');
    expect(placeRow(secs, 'a', { section: 0, index: 0 })).toBe(secs);
  });

  it('moves whole sections', () => {
    expect(ids(moveSection(secs, 's1', -1))).toBe('s1:c s0:ab');
    expect(moveSection(secs, 's1', 1)).toBe(secs);
    expect(ids(placeSection(secs, 's0', 5))).toBe('s1:c s0:ab');
    expect(allRows(secs).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('makes fresh ids', () => {
    expect(freshId('r', ['r0', 'r1', 'r3'])).toBe('r2');
  });
});
