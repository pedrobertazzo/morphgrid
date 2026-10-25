import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DEFAULT_SHAPE, getShape, type ShapeThresholds } from './core';
import type { CellDef, ViewComponent, Views } from './types';

export interface ItemViewProps<T, V extends string> {
  item: T;
  itemId: string;
  view: V;
  views: Views<T, V>;
  shape?: ShapeThresholds;
  className?: string;
  style?: CSSProperties;
}

export function ItemView<T, V extends string>(p: ItemViewProps<T, V>) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cell: CellDef<V> = { id: `itemview-${p.view}`, view: p.view };
  const vp = {
    item: p.item, itemId: p.itemId, cell, view: p.view, ...size,
    shape: getShape(size.width, size.height, p.shape ?? DEFAULT_SHAPE), dragging: false,
  };
  let content = null;
  if (size.width) {
    if (typeof p.views === 'function') content = p.views(vp);
    else {
      const View = p.views[p.view] as ViewComponent<T, V> | undefined;
      content = View ? <View {...vp} /> : null;
    }
  }
  return (
    <div ref={ref} className={'mg-itemview' + (p.className ? ' ' + p.className : '')} style={p.style}>
      {content}
    </div>
  );
}
