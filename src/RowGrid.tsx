import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { defaultAssignment, diff, edgeSpeed, type Assignment } from './core';
import { MorphGrid } from './MorphGrid';
import {
  allRows,
  findRow,
  freshId,
  locateRow,
  moveRow,
  moveSection,
  placeRow,
  placeSection,
  pruneRows,
  rowBand,
  rowCells,
  rowLayout,
  rowSlotId,
  rowSlotIds,
  sectionBand,
  sectionCells,
  sectionHeadId,
  sectionLayout,
  shrinkRow,
  fillRows,
  type Row,
  type RowLayoutOptions,
  type RowPlace,
  type Section,
} from './rows';
import type { CellDef, CellState, MorphGridProps } from './types';

export interface RowLabels {
  type: string;
  fewer: string;
  more: string;
  remove: string;
  drop: string;
  add: string;
  moveUp: string;
  moveDown: string;
  drag: string;
  addRow: string;
  addSection: string;
  removeSection: string;
  sectionTitle: string;
  newSection: string;
  suggested: string;
}

const DEFAULT_ROW_LABELS: RowLabels = {
  type: 'Show this row as',
  fewer: 'Fewer slots',
  more: 'More slots',
  remove: 'Remove row',
  drop: 'Drop here',
  add: 'Add…',
  moveUp: 'Move up',
  moveDown: 'Move down',
  drag: 'Drag to move, or use the arrow keys',
  addRow: 'Add row',
  addSection: 'Add section',
  removeSection: 'Remove section',
  sectionTitle: 'Section title',
  newSection: 'New section',
  suggested: 'Best fit',
};

// Spread onto the element that picks up a row or section in edit mode.
export interface HandleProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => void;
  'aria-label': string;
  'data-mg-handle': string;
  tabIndex: number;
}

export interface RowHeaderProps<V extends string = string> {
  row: Row<V>;
  // Position among all rows on the board, counting across sections.
  index: number;
  filled: number;
  views: V[];
  labelOf: (view: V) => string;
  maxSlots: number;
  // Edit mode is on and the board can change: show the tools.
  editable: boolean;
  labels: RowLabels;
  setView: (view: V) => void;
  setSlots: (slots: number) => void;
  remove: () => void;
  section: Section<V> | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveBy: (delta: -1 | 1) => void;
  // Adds a row above this one; undefined when the board is full or not editable.
  insertRow?: () => void;
  handle: HandleProps;
  lifted: boolean;
}

export interface SectionHeaderProps<V extends string = string> {
  section: Section<V>;
  index: number;
  count: number;
  filled: number;
  slots: number;
  editable: boolean;
  labels: RowLabels;
  rename: (title: string) => void;
  // Undefined for the last remaining section.
  remove?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveBy: (delta: -1 | 1) => void;
  addRow?: () => void;
  handle: HandleProps;
  lifted: boolean;
}

export interface SlotProps<T, V extends string = string> {
  row: Row<V>;
  slot: number;
  cellId: string;
  over: boolean;
  suggested: boolean;
  // Items not on the grid, in cycle order: what this slot can take without moving anything else.
  offGrid: T[];
  place: (item: T) => void;
  labelOf: (item: T) => string;
  labels: RowLabels;
}

export interface FooterProps {
  editable: boolean;
  labels: RowLabels;
  addRow?: () => void;
  addSection?: () => void;
}

export function DefaultSlot<T, V extends string>(p: SlotProps<T, V>) {
  const hint = p.suggested ? `✦ ${p.labels.suggested}` : p.labels.drop;
  if (p.over || p.suggested || !p.offGrid.length) return <div className="mg-hint">{hint}</div>;
  return (
    <div className="mg-slotpick">
      <span className="mg-hint">{p.labels.drop}</span>
      <select aria-label={p.labels.add} value="" onChange={(e) => e.target.value && p.place(p.offGrid[+e.target.value])}>
        <option value="">{p.labels.add}</option>
        {p.offGrid.map((item, i) => (
          <option key={i} value={i}>{p.labelOf(item)}</option>
        ))}
      </select>
    </div>
  );
}

export function Grip(props: HandleProps & { className?: string }) {
  const { className, ...h } = props;
  return (
    <span role="button" className={'mg-grip' + (className ? ' ' + className : '')} title={h['aria-label']} {...h}>
      <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden>
        {[3, 8, 13].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.4" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.4" />])}
      </svg>
    </span>
  );
}

export function DefaultRowHeader<V extends string>(p: RowHeaderProps<V>) {
  return (
    <div className="mg-rowbar">
      {p.editable && <Grip {...p.handle} />}
      {p.editable ? (
        <select className="mg-rowtype" aria-label={p.labels.type} value={p.row.view} onChange={(e) => p.setView(e.target.value as V)}>
          {p.views.map((v) => (
            <option key={v} value={v}>{p.labelOf(v)}</option>
          ))}
        </select>
      ) : (
        <span className="mg-rowtype">{p.labelOf(p.row.view)}</span>
      )}
      <span className="mg-rowmeta">
        {p.filled} of {p.row.slots}
      </span>
      {p.editable && (
        <span className="mg-rowtools">
          <button type="button" aria-label={p.labels.moveUp} disabled={!p.canMoveUp} onClick={() => p.moveBy(-1)}>↑</button>
          <button type="button" aria-label={p.labels.moveDown} disabled={!p.canMoveDown} onClick={() => p.moveBy(1)}>↓</button>
          <button type="button" aria-label={p.labels.fewer} disabled={p.row.slots <= 1} onClick={() => p.setSlots(p.row.slots - 1)}>−</button>
          <button type="button" aria-label={p.labels.more} disabled={p.row.slots >= p.maxSlots} onClick={() => p.setSlots(p.row.slots + 1)}>+</button>
          <button type="button" aria-label={p.labels.remove} onClick={p.remove}>×</button>
        </span>
      )}
    </div>
  );
}

export function DefaultSectionHeader<V extends string>(p: SectionHeaderProps<V>) {
  return (
    <div className="mg-sectionbar">
      {p.editable && <Grip {...p.handle} />}
      {p.editable ? (
        <input
          className="mg-sectiontitle"
          aria-label={p.labels.sectionTitle}
          value={p.section.title}
          maxLength={60}
          onChange={(e) => p.rename(e.target.value)}
        />
      ) : (
        <h3 className="mg-sectiontitle">{p.section.title}</h3>
      )}
      <span className="mg-rowmeta">
        {p.section.rows.length} row{p.section.rows.length === 1 ? '' : 's'} · {p.filled} of {p.slots}
      </span>
      {p.editable && (
        <span className="mg-rowtools">
          <button type="button" aria-label={p.labels.moveUp} disabled={!p.canMoveUp} onClick={() => p.moveBy(-1)}>↑</button>
          <button type="button" aria-label={p.labels.moveDown} disabled={!p.canMoveDown} onClick={() => p.moveBy(1)}>↓</button>
          {p.addRow && <button type="button" className="mg-pill" onClick={p.addRow}>+ {p.labels.addRow}</button>}
          {p.remove && <button type="button" aria-label={p.labels.removeSection} onClick={p.remove}>×</button>}
        </span>
      )}
    </div>
  );
}

export function DefaultFooter(p: FooterProps) {
  if (!p.editable || (!p.addRow && !p.addSection)) return null;
  return (
    <div className="mg-footer">
      {p.addRow && <button type="button" className="mg-add" onClick={p.addRow}>+ {p.labels.addRow}</button>}
      {p.addSection && <button type="button" className="mg-add" onClick={p.addSection}>+ {p.labels.addSection}</button>}
    </div>
  );
}

export interface RowGridProps<T, V extends string = string>
  extends Omit<MorphGridProps<T, V>, 'cells' | 'layout' | 'renderCell' | 'renderBand'> {
  // Pass either flat rows, or sections (parent blocks) of rows.
  rows?: Row<V>[];
  onRowsChange?: (rows: Row<V>[]) => void;
  sections?: Section<V>[];
  onSectionsChange?: (sections: Section<V>[]) => void;
  // Edit mode: shows the tools to add, remove, resize and reorder rows and sections. Items can always be
  // dragged between slots. Defaults to true, so a board with an onChange handler is editable as before.
  editing?: boolean;
  rowLayout?: RowLayoutOptions<V>;
  viewOrder?: V[];
  maxSlots?: number;
  maxRows?: number;
  rowLabels?: Partial<RowLabels>;
  renderHeader?: (p: RowHeaderProps<V>) => ReactNode;
  renderSection?: (p: SectionHeaderProps<V>) => ReactNode;
  renderSlot?: (p: SlotProps<T, V>) => ReactNode;
  renderFooter?: false | ((p: FooterProps) => ReactNode);
  // Which off-grid item a new slot starts with; false leaves new slots empty.
  fillSlot?: false | ((row: Row<V>, offGrid: T[]) => T | undefined);
  // The view and size of a row added from the tools. Defaults to the first view, two slots.
  makeRow?: (offGrid: T[], section: Section<V> | null) => { view: V; slots: number };
}

type Lift = { kind: 'row' | 'section'; id: string };

// A MorphGrid laid out in rows, optionally grouped into sections. Each row's header picks one view for all its
// slots; items move between rows by drag, keyboard or cycling, and redraw in the view of the row they land in.
export function RowGrid<T, V extends string>(props: RowGridProps<T, V>) {
  const {
    rows: flatRows, onRowsChange, sections: groupedSections, onSectionsChange, editing = true,
    rowLayout: layoutOpts, viewOrder, maxSlots = 4, maxRows = Infinity, renderHeader, renderSection, renderSlot,
    renderFooter, fillSlot, makeRow, value, defaultValue, onChange, onAnnounce, rowLabels: _rowLabels, ...rest
  } = props;
  const labels = useMemo(() => ({ ...DEFAULT_ROW_LABELS, ...props.rowLabels }), [props.rowLabels]);
  const grouped = groupedSections !== undefined;
  const secs = useMemo<Section<V>[]>(
    () => groupedSections ?? [{ id: '', title: '', rows: flatRows ?? [] }],
    [groupedSections, flatRows],
  );
  const rows = useMemo(() => allRows(secs), [secs]);
  const views = viewOrder ?? ((typeof props.views === 'function' ? Object.keys(props.viewLabels ?? {}) : Object.keys(props.views)) as V[]);
  const cells = useMemo(() => (grouped ? sectionCells(secs, views[0]) : rowCells(rows)), [grouped, secs, rows, views[0]]);
  const layout = useMemo(() => (grouped ? sectionLayout(secs, layoutOpts) : rowLayout(rows, layoutOpts)), [grouped, secs, rows, layoutOpts]);
  const itemIds = useMemo(() => props.items.map(props.getItemId), [props.items, props.getItemId]);

  // Headers never hold items, so the default fills slots only.
  const [inner, setInner] = useState<Assignment>(
    () => defaultValue ?? { ...fillRows(rows, []), ...defaultAssignment(rows.flatMap(rowSlotIds), itemIds) },
  );
  const current = value ?? inner;
  const commit: NonNullable<MorphGridProps<T, V>['onChange']> = (next, detail) => {
    if (value === undefined) setInner(next);
    onChange?.(next, detail);
  };

  const [status, setStatus] = useState('');
  const say = (message: string) => {
    setStatus(message);
    onAnnounce?.(message);
  };

  const canChange = grouped ? !!onSectionsChange : !!onRowsChange;
  const editable = canChange && !props.disabled && editing;
  const labelOf = (v: V) => props.viewLabels?.[v] ?? v;
  const itemLabel = (item: T) => props.getItemLabel?.(item) ?? props.getItemId(item);
  const byId = useMemo(() => new Map(props.items.map((i) => [props.getItemId(i), i])), [props.items, props.getItemId]);
  const placed = new Set(Object.values(current));
  const offGrid = (props.cycleOrder ?? itemIds).filter((id) => byId.has(id) && !placed.has(id)).map((id) => byId.get(id)!);

  const emit = (next: Section<V>[]) => (grouped ? onSectionsChange?.(next) : onRowsChange?.(next[0]?.rows ?? []));

  // `fill` lists new slots that should start with an off-grid item; `patch` sets slots outright.
  const change = (
    next: Section<V>[],
    message: string,
    opts: { fill?: { row: Row<V>; cellId: string }[]; patch?: Record<string, string | null> } = {},
  ) => {
    emit(next);
    const out: Record<string, string | null> = { ...pruneRows(current, allRows(next), itemIds), ...opts.patch };
    const left = [...offGrid];
    const added: string[] = [];
    for (const { row, cellId } of opts.fill ?? []) {
      const item = fillSlot === false ? undefined : fillSlot ? fillSlot(row, left) : left[0];
      if (!item) continue;
      left.splice(left.indexOf(item), 1);
      out[cellId] = props.getItemId(item);
      added.push(itemLabel(item));
    }
    const moves = diff(current, out);
    if (moves.length) commit(out, { reason: 'rows', itemId: moves[0].itemId, moves });
    if (message) say(message + (added.length ? ` Added ${added.join(', ')}.` : ''));
  };
  const mapRow = (id: string, f: (r: Row<V>) => Row<V>) => secs.map((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? f(r) : r)) }));

  const newRow = (section: Section<V> | null): Row<V> => {
    const shape = makeRow?.(offGrid, section) ?? { view: views[0], slots: 2 };
    return { id: freshId('r', [...rows.map((r) => r.id), ...secs.map((s) => s.id)]), view: shape.view, slots: Math.max(1, Math.min(maxSlots, shape.slots)) };
  };
  const fillAll = (row: Row<V>) => rowSlotIds(row).map((cellId) => ({ row, cellId }));
  const canAddRow = editable && rows.length < maxRows;

  const insertRow = (to: RowPlace) => {
    const section = secs[to.section] ?? null;
    const row = newRow(grouped ? section : null);
    const next = secs.map((s, i) => (i === to.section ? { ...s, rows: [...s.rows.slice(0, to.index), row, ...s.rows.slice(to.index)] } : s));
    const where = grouped && section ? ` to ${section.title || `section ${to.section + 1}`}` : '';
    change(next, `Added a ${labelOf(row.view).toLowerCase()} row${where}.`, { fill: fillAll(row) });
  };

  const addSection = () => {
    const row = newRow(null);
    const id = freshId('s', [...rows.map((r) => r.id), ...secs.map((s) => s.id)]);
    const title = `${labels.newSection} ${secs.length + 1}`;
    change([...secs, { id, title, rows: [row] }], `Added ${title}.`, { fill: fillAll(row) });
  };

  // Dragging a row or section by its grip: the board reorders live as the pointer passes the middle of a neighbour,
  // so the whole parent, visualizations and all, slides into place.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const liftRef = useRef<(Lift & { y: number; frame: number; start: Section<V>[] }) | null>(null);
  const live = useRef({ secs, emit, grouped, say });
  live.current = { secs, emit, grouped, say };
  const focusHandle = useRef<string | null>(null);

  useLayoutEffect(() => {
    const id = focusHandle.current;
    if (!id) return;
    focusHandle.current = null;
    wrapRef.current?.querySelector<HTMLElement>(`[data-mg-handle="${id}"]`)?.focus({ preventScroll: true });
  });

  const reorderTo = (y: number) => {
    const L = liftRef.current;
    const wrap = wrapRef.current;
    if (!L || !wrap) return;
    const { secs: S, grouped: G } = live.current;
    const box = (band: string) => wrap.querySelector(`[data-band="${band}"]`)?.getBoundingClientRect();
    const before = (band: string) => {
      const r = box(band);
      return !!r && y < r.top + r.height / 2;
    };
    let next = S;
    if (L.kind === 'section') {
      const others = S.filter((s) => s.id !== L.id);
      const to = others.findIndex((s) => before(sectionBand(s)));
      next = placeSection(S, L.id, to < 0 ? others.length : to);
    } else {
      let to: RowPlace | null = null;
      for (let si = 0; si < S.length && !to; si++) {
        const others = S[si].rows.filter((r) => r.id !== L.id);
        const k = others.findIndex((r) => before(rowBand(r)));
        if (k >= 0) to = { section: si, index: k };
        else if (G) {
          const b = box(sectionBand(S[si]));
          if (b && y < b.bottom) to = { section: si, index: others.length };
        }
      }
      const last = S.length - 1;
      next = placeRow(S, L.id, to ?? { section: last, index: S[last].rows.filter((r) => r.id !== L.id).length });
    }
    if (next !== S) {
      live.current.secs = next;
      live.current.emit(next);
    }
  };

  useEffect(() => {
    if (!lift) return;
    const move = (e: PointerEvent) => {
      if (!liftRef.current) return;
      liftRef.current.y = e.clientY;
      reorderTo(e.clientY);
    };
    const tick = () => {
      const L = liftRef.current;
      if (!L) return;
      const v = edgeSpeed(L.y, 0, innerHeight);
      if (v) {
        const before = scrollY;
        scrollBy(0, v);
        if (scrollY !== before) reorderTo(L.y);
      }
      L.frame = requestAnimationFrame(tick);
    };
    const end = () => {
      const L = liftRef.current;
      if (!L) return;
      cancelAnimationFrame(L.frame);
      liftRef.current = null;
      setLift(null);
      const { secs: S, say: announce } = live.current;
      if (S === L.start) return;
      if (L.kind === 'section') {
        const i = S.findIndex((s) => s.id === L.id);
        announce(`${S[i]?.title || 'Section'} moved to position ${i + 1}.`);
      } else {
        const at = locateRow(S, L.id);
        const n = allRows(S).findIndex((r) => r.id === L.id) + 1;
        announce(`Row moved to position ${n}${grouped && at ? ` in ${S[at.section].title || `section ${at.section + 1}`}` : ''}.`);
      }
    };
    liftRef.current!.frame = requestAnimationFrame(tick);
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      if (liftRef.current) cancelAnimationFrame(liftRef.current.frame);
    };
  }, [lift?.kind, lift?.id]);

  const handleFor = (kind: Lift['kind'], id: string, moveBy: (d: -1 | 1) => void, label: string): HandleProps => ({
    'aria-label': label,
    'data-mg-handle': `${kind}:${id}`,
    tabIndex: editable ? 0 : -1,
    onPointerDown: (e) => {
      if (!editable || e.button > 0) return;
      e.preventDefault();
      liftRef.current = { kind, id, y: e.clientY, frame: 0, start: secs };
      setLift({ kind, id });
    },
    onKeyDown: (e) => {
      const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!d || !editable) return;
      e.preventDefault();
      focusHandle.current = `${kind}:${id}`;
      moveBy(d);
    },
  });

  const rowHeader = (row: Row<V>, index: number): RowHeaderProps<V> => {
    const at = locateRow(secs, row.id)!;
    const section = grouped ? secs[at.section] : null;
    const n = index + 1;
    const moveBy = (d: -1 | 1) => {
      const next = moveRow(secs, row.id, d);
      if (next !== secs) change(next, `Row ${n} moved ${d < 0 ? 'up' : 'down'}.`);
    };
    return {
      row, index, section, views, labelOf, maxSlots, editable, labels,
      filled: rowSlotIds(row).filter((id) => current[id]).length,
      canMoveUp: editable && (at.index > 0 || at.section > 0),
      canMoveDown: editable && (at.index < secs[at.section].rows.length - 1 || at.section < secs.length - 1),
      moveBy,
      insertRow: canAddRow ? () => insertRow(at) : undefined,
      handle: handleFor('row', row.id, moveBy, `${labels.drag}: row ${n}`),
      lifted: lift?.kind === 'row' && lift.id === row.id,
      setView: (view) => change(mapRow(row.id, (r) => ({ ...r, view })), `Row ${n} now shows ${labelOf(view).toLowerCase()}.`),
      setSlots: (slots) => {
        const resized = { ...row, slots };
        const msg = `Row ${n} has ${slots} slot${slots === 1 ? '' : 's'}.`;
        if (slots >= row.slots) {
          const fill = Array.from({ length: slots - row.slots }, (_, k) => ({ row: resized, cellId: rowSlotId(resized, row.slots + k) }));
          change(mapRow(row.id, () => resized), msg, { fill });
          return;
        }
        // Shrinking drops empty slots first; the cards left slide together.
        const kept = shrinkRow(rowSlotIds(row).map((id) => current[id] ?? null), slots);
        const patch = Object.fromEntries(kept.map((item, k) => [rowSlotId(resized, k), item]));
        change(mapRow(row.id, () => resized), msg, { patch });
      },
      remove: () => change(secs.map((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== row.id) })), `Row ${n} removed.`),
    };
  };

  const sectionHeader = (section: Section<V>, index: number): SectionHeaderProps<V> => {
    const ids = section.rows.flatMap(rowSlotIds);
    const name = section.title || `Section ${index + 1}`;
    const moveBy = (d: -1 | 1) => {
      const next = moveSection(secs, section.id, d);
      if (next !== secs) change(next, `${name} moved ${d < 0 ? 'up' : 'down'}.`);
    };
    return {
      section, index, count: secs.length, editable, labels, moveBy,
      filled: ids.filter((id) => current[id]).length,
      slots: ids.length,
      canMoveUp: editable && index > 0,
      canMoveDown: editable && index < secs.length - 1,
      rename: (title) => change(secs.map((s) => (s.id === section.id ? { ...s, title } : s)), ''),
      remove: secs.length > 1 ? () => change(secs.filter((s) => s.id !== section.id), `${name} removed.`) : undefined,
      addRow: canAddRow ? () => insertRow({ section: index, index: section.rows.length }) : undefined,
      handle: handleFor('section', section.id, moveBy, `${labels.drag}: ${name}`),
      lifted: lift?.kind === 'section' && lift.id === section.id,
    };
  };

  const renderCell = (cell: CellDef<V>, state: CellState) => {
    if (grouped) {
      const si = secs.findIndex((s) => sectionHeadId(s) === cell.id);
      if (si >= 0) {
        const h = sectionHeader(secs[si], si);
        return renderSection ? renderSection(h) : <DefaultSectionHeader {...h} />;
      }
    }
    const hit = findRow(rows, cell.id);
    if (!hit) return null;
    const { row, index, slot } = hit;
    if (slot !== null) {
      if (!state.empty) return null;
      const p: SlotProps<T, V> = {
        row, slot, cellId: cell.id, over: state.over, suggested: state.suggested, offGrid, labelOf: itemLabel, labels,
        place: (item) => {
          const id = props.getItemId(item);
          const next = { ...current, [cell.id]: id };
          commit(next, { reason: 'pick', itemId: id, moves: diff(current, next) });
          say(`Added ${itemLabel(item)}.`);
        },
      };
      return renderSlot ? renderSlot(p) : <DefaultSlot {...p} />;
    }
    const h = rowHeader(row, index);
    return renderHeader ? renderHeader(h) : <DefaultRowHeader {...h} />;
  };

  const renderBand = (id: string) => (lift && id === `${lift.kind}:${lift.id}` ? <i className="mg-lift" /> : null);

  const footer: FooterProps = {
    editable,
    labels,
    addRow: canAddRow ? () => insertRow({ section: secs.length - 1, index: secs[secs.length - 1]?.rows.length ?? 0 }) : undefined,
    addSection: grouped && canAddRow ? addSection : undefined,
  };

  return (
    <div ref={wrapRef} className="mg-rowgrid" data-editing={editable || undefined} data-lifting={lift?.kind}>
      <MorphGrid<T, V>
        {...rest}
        className={'mg-rows' + (grouped ? ' mg-sections' : '') + (editable ? ' mg-editing' : '') + (props.className ? ' ' + props.className : '')}
        cells={cells}
        layout={layout}
        value={current}
        onChange={commit}
        onAnnounce={onAnnounce}
        renderCell={renderCell}
        renderBand={renderBand}
      />
      {renderFooter === false ? null : renderFooter ? renderFooter(footer) : <DefaultFooter {...footer} />}
      <div className="mg-sr" aria-live="polite" role="status">
        {status}
      </div>
    </div>
  );
}
