import { describe, expect, it } from 'vitest';
import {
  cycleItem,
  defaultAssignment,
  diff,
  findNeighbor,
  getShape,
  gridStyle,
  hitTest,
  normalize,
  placeItem,
  resolveLayout,
} from '../src/core';

const base = { a: 'x', b: 'y', c: 'z', d: null };

describe('placeItem', () => {
  it('swaps with the occupant', () => {
    expect(placeItem(base, 'x', 'b')).toEqual({ a: 'y', b: 'x', c: 'z', d: null });
  });
  it('moves into an empty cell, leaving the old one empty', () => {
    expect(placeItem(base, 'x', 'd')).toEqual({ a: null, b: 'y', c: 'z', d: 'x' });
  });
  it('previews relative to the snapshot, so wandering never scrambles', () => {
    const overB = placeItem(base, 'x', 'b')!;
    const overC = placeItem(base, 'x', 'c')!;
    expect(overB).toEqual({ a: 'y', b: 'x', c: 'z', d: null });
    expect(overC).toEqual({ a: 'z', b: 'y', c: 'x', d: null });
  });
  it('pushes the occupant off the grid when the item comes from the pool', () => {
    expect(placeItem(base, 'p', 'a')).toEqual({ a: 'p', b: 'y', c: 'z', d: null });
  });
  it('respects placement rules both ways', () => {
    expect(placeItem(base, 'x', 'b', (_i, c) => c !== 'b')).toBeNull();
    expect(placeItem(base, 'x', 'b', (i, c) => !(i === 'y' && c === 'a'))).toBeNull();
  });
  it('rejects unknown cells', () => {
    expect(placeItem(base, 'x', 'nope')).toBeNull();
  });
});

describe('cycleItem', () => {
  const order = ['x', 'y', 'z', 'p'];
  it('trades with whichever cell holds the next item', () => {
    expect(cycleItem(base, 'a', order, 1)).toEqual({ next: { a: 'y', b: 'x', c: 'z', d: null }, itemId: 'y' });
  });
  it('brings in pool items and wraps around', () => {
    expect(cycleItem(base, 'c', order, 1)!.next).toEqual({ a: 'x', b: 'y', c: 'p', d: null });
    expect(cycleItem(base, 'a', order, -1)!.itemId).toBe('p');
  });
  it('skips items a rule forbids', () => {
    const locked = (_i: string, c: string) => c !== 'b';
    expect(cycleItem(base, 'a', order, 1, locked)!.itemId).toBe('z');
  });
  it('fills an empty cell', () => {
    expect(cycleItem(base, 'd', order, 1)!.itemId).toBe('x');
  });
});

describe('helpers', () => {
  it('defaultAssignment and normalize', () => {
    expect(defaultAssignment(['a', 'b'], ['x'])).toEqual({ a: 'x', b: null });
    expect(normalize({ a: 'x', b: 'x', z: 'y' }, ['a', 'b', 'c'], ['x', 'y'])).toEqual({ a: 'x', b: null, c: null });
  });
  it('diff lists moves', () => {
    expect(diff(base, { a: 'y', b: 'x', c: null, d: null })).toEqual([
      { itemId: 'x', from: 'a', to: 'b' },
      { itemId: 'y', from: 'b', to: 'a' },
      { itemId: 'z', from: 'c', to: null },
    ]);
  });
  it('hitTest and findNeighbor', () => {
    const rects = {
      a: { left: 0, top: 0, width: 100, height: 100 },
      b: { left: 110, top: 0, width: 100, height: 100 },
      c: { left: 0, top: 110, width: 210, height: 100 },
    };
    expect(hitTest(rects, 50, 50)).toBe('a');
    expect(hitTest(rects, 105, 50)).toBeNull();
    expect(findNeighbor(rects, 'a', 'right')).toBe('b');
    expect(findNeighbor(rects, 'b', 'down')).toBe('c');
    expect(findNeighbor(rects, 'a', 'left')).toBeNull();
  });
  it('getShape', () => {
    expect(getShape(300, 100)).toBe('wide');
    expect(getShape(100, 300)).toBe('tall');
    expect(getShape(100, 100)).toBe('square');
  });
  it('resolveLayout picks the narrowest matching breakpoint and merges areas', () => {
    const layout = {
      columns: 4,
      areas: { a: '1/1', b: '1/2' },
      breakpoints: [
        { maxWidth: 1000, columns: 3 },
        { maxWidth: 600, columns: 2, areas: { a: '2/1' } },
      ],
    };
    expect(resolveLayout(layout, 1200).columns).toBe(4);
    expect(resolveLayout(layout, 800).columns).toBe(3);
    expect(resolveLayout(layout, 500)).toEqual({ columns: 2, areas: { a: '2/1', b: '1/2' } });
  });
  it('gridStyle', () => {
    expect(gridStyle({ columns: 3, rowHeight: 120, gap: 8, templateAreas: ['a b', 'c c'] })).toMatchObject({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gridAutoRows: '120px',
      gap: '8px',
      gridTemplateAreas: '"a b" "c c"',
    });
  });
});
