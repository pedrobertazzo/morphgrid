import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  type Assignment,
  type CanPlace,
  type Direction,
  type Move,
  type Rect,
  type Shape,
  DEFAULT_SHAPE,
  cycleItem,
  defaultAssignment,
  diff,
  findCell,
  findNeighbor,
  getShape,
  gridStyle,
  hitTest,
  normalize,
  placeItem,
  resolveLayout,
  sameAssignment,
} from './core';
import { DefaultChrome } from './DefaultChrome';
import type { CellDef, ChangeDetail, ChangeReason, ChromeProps, Labels, MorphGridProps, ViewComponent, ViewProps } from './types';

const NODRAG = '[data-mg-nodrag],button,input,select,textarea,a[href],[contenteditable="true"]';

const DEFAULT_LABELS: Labels = {
  cycle: 'change data',
  cyclePrev: 'Previous data',
  cycleNext: 'Next data',
  blockHint: 'Drag or use arrow keys to move.',
};

const ARROWS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

type Drag = {
  itemId: string;
  home: string;
  snapshot: Assignment;
  hit: string;
  refused: string | null;
};

type Gesture = {
  itemId: string | null;
  pointerId: number;
  touch: boolean;
  armed: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout> | null;
  lastTap: number;
};

const sameRects = (a: Record<string, Rect>, b: Record<string, Rect>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k], y = b[k];
    return y && x.left === y.left && x.top === y.top && x.width === y.width && x.height === y.height;
  });
};

export function MorphGrid<T, V extends string = string>(props: MorphGridProps<T, V>) {
  const {
    cells,
    items,
    getItemId,
    getItemLabel,
    views,
    viewLabels,
    layout,
    chrome,
    cycle = true,
    cycleOrder,
    shape = DEFAULT_SHAPE,
    onOpen,
    announce,
    onAnnounce,
    renderCell,
    disabled,
    longPressMs = 230,
    className,
    style,
  } = props;
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...props.labels }), [props.labels]);
  const Chrome = chrome === false ? null : chrome ?? DefaultChrome;

  const cellIds = useMemo(() => cells.map((c) => c.id), [cells]);
  const cellById = useMemo(() => new Map(cells.map((c) => [c.id, c])), [cells]);
  const itemById = useMemo(() => new Map(items.map((i) => [getItemId(i), i])), [items, getItemId]);
  const itemIds = useMemo(() => [...itemById.keys()], [itemById]);
  const order = cycleOrder ?? itemIds;

  const [inner, setInner] = useState<Assignment>(() => props.defaultValue ?? defaultAssignment(cellIds, itemIds));
  const assignment = useMemo(
    () => normalize(props.value ?? inner, cellIds, itemIds),
    [props.value, inner, cellIds, itemIds],
  );

  const canPlace = useCallback<CanPlace>(
    (itemId, cellId) => {
      const c = cellById.get(cellId);
      return !!c && !c.locked && (c.accepts ? c.accepts(itemId) : true);
    },
    [cellById],
  );

  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const display = drag ? placeItem(drag.snapshot, drag.itemId, drag.hit, canPlace) ?? drag.snapshot : assignment;

  const [instant, setInstant] = useState<Set<string>>(() => new Set());
  const [nonce, setNonce] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!instant.size) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(new Set())));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  const [status, setStatus] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);
  const cellEls = useRef(new Map<string, HTMLDivElement>());
  const blockEls = useRef(new Map<string, HTMLDivElement>());
  const [width, setWidth] = useState(0);
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const config = resolveLayout(layout, width);

  const measure = useCallback(() => {
    const next: Record<string, Rect> = {};
    cellEls.current.forEach((el, id) => {
      next[id] = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    });
    setRects((prev) => (sameRects(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current) setWidth(rootRef.current.clientWidth);
    measure();
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      setWidth(root.clientWidth);
      measure();
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [measure]);

  const labelOf = useCallback(
    (id: string) => {
      const item = itemById.get(id);
      return item !== undefined && getItemLabel ? getItemLabel(item) : id;
    },
    [itemById, getItemLabel],
  );
  const cellName = useCallback(
    (id: string) => {
      const c = cellById.get(id);
      return c ? c.name ?? viewLabels?.[c.view] ?? c.view : id;
    },
    [cellById, viewLabels],
  );
  const describe = useCallback(
    (m: Move) => (m.to ? `${labelOf(m.itemId)} moved to ${cellName(m.to)}` : `${labelOf(m.itemId)} left the grid`),
    [labelOf, cellName],
  );

  const commit = useCallback(
    (next: Assignment, reason: ChangeReason, itemId: string, prev: Assignment) => {
      const moves = diff(prev, next);
      if (!moves.length) return;
      moves.sort((a, b) => (a.itemId === itemId ? -1 : b.itemId === itemId ? 1 : 0));
      const detail: ChangeDetail = { reason, itemId, moves };
      if (props.value === undefined) setInner(next);
      props.onChange?.(next, detail);
      const msg = announce ? announce(detail, describe) : moves.map(describe).join('; ') + '.';
      setStatus(msg);
      if (msg) onAnnounce?.(msg);
    },
    [props.value, props.onChange, announce, describe, onAnnounce],
  );

  const latest = useRef({ assignment, rects, canPlace, commit, onOpen, itemById, cellById, order, disabled, longPressMs });
  latest.current = { assignment, rects, canPlace, commit, onOpen, itemById, cellById, order, disabled, longPressMs };
  const gesture = useRef<Gesture>({
    itemId: null, pointerId: 0, touch: false, armed: false,
    startX: 0, startY: 0, dx: 0, dy: 0, x: 0, y: 0, timer: null, lastTap: 0,
  });
  const pendingFocus = useRef<{ itemId: string; selector?: string } | null>(null);

  const handlers = useMemo(() => {
    const open = (itemId: string) => {
      const L = latest.current;
      const cellId = findCell(L.assignment, itemId);
      const item = L.itemById.get(itemId);
      const cell = cellId ? L.cellById.get(cellId) : undefined;
      if (L.onOpen && item !== undefined && cell) L.onOpen(item, cell);
    };

    const place = (itemId: string) => {
      const el = blockEls.current.get(itemId);
      const g = gesture.current;
      if (el) {
        el.style.left = `${g.x}px`;
        el.style.top = `${g.y}px`;
      }
    };

    const begin = () => {
      const g = gesture.current;
      const L = latest.current;
      g.timer = null;
      if (!g.itemId) return;
      const home = findCell(L.assignment, g.itemId);
      if (!home) return;
      const root = rootRef.current!.getBoundingClientRect();
      g.x = g.startX - root.left - g.dx;
      g.y = g.startY - root.top - g.dy;
      const d: Drag = { itemId: g.itemId, home, snapshot: L.assignment, hit: home, refused: null };
      dragRef.current = d;
      setDrag(d);
      try {
        blockEls.current.get(g.itemId)?.setPointerCapture(g.pointerId);
      } catch {}
      if (g.touch) navigator.vibrate?.(8);
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, itemId: string) => {
      const L = latest.current;
      if (L.disabled || e.button > 0 || (e.target as Element).closest(NODRAG)) return;
      const g = gesture.current;
      const touch = e.pointerType === 'touch';
      if (touch) {
        const now = Date.now();
        if (now - g.lastTap < 350 && g.itemId === itemId) {
          g.lastTap = 0;
          open(itemId);
          return;
        }
        g.lastTap = now;
      }
      const home = findCell(L.assignment, itemId);
      if (!home || L.cellById.get(home)?.locked) {
        g.itemId = itemId;
        return;
      }
      const r = e.currentTarget.getBoundingClientRect();
      Object.assign(g, {
        itemId, pointerId: e.pointerId, touch, armed: !touch,
        startX: e.clientX, startY: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
      });
      if (touch) g.timer = setTimeout(begin, L.longPressMs);
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const g = gesture.current;
      const d = dragRef.current;
      if (!d) {
        const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
        if (g.timer && dist > 8) {
          clearTimeout(g.timer);
          g.timer = null;
        }
        if (g.armed && dist > 4) {
          g.armed = false;
          begin();
        }
        return;
      }
      const L = latest.current;
      const root = rootRef.current!.getBoundingClientRect();
      const px = e.clientX - root.left;
      const py = e.clientY - root.top;
      const over = hitTest(L.rects, px, py);
      let hit = d.hit;
      let refused: string | null = null;
      if (over) {
        const ok = over === d.home || !!placeItem(d.snapshot, d.itemId, over, L.canPlace);
        hit = ok ? over : d.home;
        refused = ok ? null : over;
      }
      if (hit !== d.hit || refused !== d.refused) {
        const r = L.rects[hit];
        g.dx = Math.min(g.dx, r.width - 14);
        g.dy = Math.min(g.dy, r.height - 14);
        const next = { ...d, hit, refused };
        dragRef.current = next;
        setDrag(next);
      }
      g.x = px - g.dx;
      g.y = py - g.dy;
      place(d.itemId);
    };

    const onPointerUp = () => {
      const g = gesture.current;
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
      g.armed = false;
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      const L = latest.current;
      const final = placeItem(d.snapshot, d.itemId, d.hit, L.canPlace) ?? d.snapshot;
      if (!sameAssignment(final, d.snapshot)) L.commit(final, 'drag', d.itemId, d.snapshot);
    };

    const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, itemId: string) => {
      if (e.target !== e.currentTarget) return;
      const L = latest.current;
      if (e.key === 'Enter') {
        e.preventDefault();
        open(itemId);
        return;
      }
      const dir = ARROWS[e.key];
      if (!dir || L.disabled) return;
      e.preventDefault();
      const from = findCell(L.assignment, itemId);
      if (!from || L.cellById.get(from)?.locked) return;
      const to = findNeighbor(L.rects, from, dir);
      const next = to && placeItem(L.assignment, itemId, to, L.canPlace);
      if (next) L.commit(next, 'keyboard', itemId, L.assignment);
    };

    const onCycle = (itemId: string, dir: 1 | -1) => {
      const L = latest.current;
      if (L.disabled) return;
      const cellId = findCell(L.assignment, itemId);
      if (!cellId || L.cellById.get(cellId)?.locked) return;
      const res = cycleItem(L.assignment, cellId, L.order, dir, L.canPlace);
      if (!res) return;
      const touched = diff(L.assignment, res.next).map((m) => m.itemId);
      setInstant(new Set(touched));
      setNonce((n) => {
        const out = { ...n };
        touched.forEach((id) => (out[id] = (out[id] ?? 0) + 1));
        return out;
      });
      pendingFocus.current = { itemId: res.itemId, selector: `[data-mg-cycle="${dir > 0 ? 'next' : 'prev'}"]` };
      L.commit(res.next, 'cycle', res.itemId, L.assignment);
    };

    return { onPointerDown, onPointerMove, onPointerUp, onKeyDown, onCycle, onDoubleClick: open };
  }, []);

  useLayoutEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    pendingFocus.current = null;
    const el = blockEls.current.get(f.itemId);
    const target = (f.selector && el?.querySelector<HTMLElement>(f.selector)) || el;
    target?.focus({ preventScroll: true });
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    root.addEventListener('touchmove', stop, { passive: false });
    return () => root.removeEventListener('touchmove', stop);
  }, []);

  useEffect(() => () => {
    if (gesture.current.timer) clearTimeout(gesture.current.timer);
  }, []);

  const placed: [string, string][] = [];
  for (const c of cellIds) if (display[c]) placed.push([display[c]!, c]);
  placed.sort((a, b) => itemIds.indexOf(a[0]) - itemIds.indexOf(b[0]));

  const setCellEl = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cellEls.current.set(id, el);
    else cellEls.current.delete(id);
  }, []);
  const setBlockEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) blockEls.current.set(id, el);
    else blockEls.current.delete(id);
  }, []);

  return (
    <div
      ref={rootRef}
      className={'mg-grid' + (className ? ' ' + className : '') + (drag ? ' mg-has-drag' : '')}
      style={{ ...(gridStyle(config) as CSSProperties), ...style }}
    >
      {cells.map((c) => {
        const over = !!drag && drag.hit === c.id;
        const empty = !display[c.id];
        return (
          <div
            key={c.id}
            ref={setCellEl(c.id)}
            className={'mg-cell' + (c.className ? ' ' + c.className : '')}
            data-over={over || undefined}
            data-refused={drag?.refused === c.id || undefined}
            data-empty={empty || undefined}
            data-locked={c.locked || undefined}
            style={{ gridArea: config.areas?.[c.id] ?? c.area }}
          >
            {renderCell ? renderCell(c, { over, empty }) : c.hint != null && <div className="mg-hint">{c.hint}</div>}
          </div>
        );
      })}
      {placed.map(([itemId, cellId]) => {
        const isDragged = drag?.itemId === itemId;
        const rect = rects[cellId];
        if (!rect) return null;
        const cell = cellById.get(cellId)!;
        const g = gesture.current;
        return (
          <Block<T, V>
            key={itemId}
            itemId={itemId}
            item={itemById.get(itemId)!}
            cell={cell}
            left={isDragged ? g.x : rect.left}
            top={isDragged ? g.y : rect.top}
            width={rect.width}
            height={rect.height}
            shape={getShape(rect.width, rect.height, shape)}
            dragging={isDragged}
            instant={instant.has(itemId)}
            nonce={nonce[itemId] ?? 0}
            label={labelOf(itemId)}
            viewLabel={viewLabels?.[cell.view] ?? cell.view}
            views={views}
            Chrome={Chrome}
            canCycle={cycle && !cell.locked && order.length > 1}
            labels={labels}
            handlers={handlers}
            setEl={setBlockEl}
          />
        );
      })}
      <div className="mg-sr" aria-live="polite" role="status">
        {status}
      </div>
    </div>
  );
}

type BlockProps<T, V extends string> = {
  itemId: string;
  item: T;
  cell: CellDef<V>;
  left: number;
  top: number;
  width: number;
  height: number;
  shape: Shape;
  dragging: boolean;
  instant: boolean;
  nonce: number;
  label: string;
  viewLabel: string;
  views: MorphGridProps<T, V>['views'];
  Chrome: React.ComponentType<ChromeProps<T, V>> | null;
  canCycle: boolean;
  labels: Labels;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>, id: string) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>, id: string) => void;
    onCycle: (id: string, dir: 1 | -1) => void;
    onDoubleClick: (id: string) => void;
  };
  setEl: (id: string, el: HTMLDivElement | null) => void;
};

function BlockImpl<T, V extends string>(p: BlockProps<T, V>) {
  const { itemId, item, cell, width, height, shape, dragging, handlers, Chrome } = p;
  const vp: ViewProps<T, V> = { item, itemId, cell, view: cell.view, width, height, shape, dragging };

  let content: ReactNode;
  if (typeof p.views === 'function') content = p.views(vp);
  else {
    const View = p.views[cell.view] as ViewComponent<T, V> | undefined;
    content = View ? <View {...vp} /> : null;
  }
  content = (
    <div className="mg-content" key={`${cell.view}|${shape}|${p.nonce}`}>
      {content}
    </div>
  );

  const cycle = useCallback((dir: 1 | -1) => handlers.onCycle(itemId, dir), [handlers, itemId]);
  const open = useCallback(() => handlers.onDoubleClick(itemId), [handlers, itemId]);
  const ref = useCallback((el: HTMLDivElement | null) => p.setEl(itemId, el), [p.setEl, itemId]);

  return (
    <div
      ref={ref}
      className={'mg-block' + (dragging ? ' mg-dragging' : '') + (p.instant ? ' mg-instant' : '')}
      style={{ left: p.left, top: p.top, width, height }}
      tabIndex={0}
      role="group"
      aria-roledescription="movable item"
      aria-label={`${p.label}, shown as ${p.viewLabel}. ${p.labels.blockHint}`}
      data-view={cell.view}
      data-locked={cell.locked || undefined}
      data-shape={shape}
      onPointerDown={(e) => handlers.onPointerDown(e, itemId)}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      onLostPointerCapture={handlers.onPointerUp}
      onKeyDown={(e) => handlers.onKeyDown(e, itemId)}
      onDoubleClick={(e) => {
        if (!(e.target as Element).closest(NODRAG)) handlers.onDoubleClick(itemId);
      }}
      onContextMenu={(e) => dragging && e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {Chrome ? (
        <Chrome
          {...vp}
          label={p.label}
          viewLabel={p.viewLabel}
          cycle={cycle}
          open={open}
          canCycle={p.canCycle}
          labels={p.labels}
        >
          {content}
        </Chrome>
      ) : (
        content
      )}
    </div>
  );
}

const Block = memo(BlockImpl) as typeof BlockImpl;
