import { useMemo, useState, type ReactNode } from 'react';
import { defaultAssignment, diff, type Assignment } from './core';
import { MorphGrid } from './MorphGrid';
import { findRow, fillRows, pruneRows, rowCells, rowLayout, rowSlotId, rowSlotIds, type Row, type RowLayoutOptions } from './rows';
import type { CellDef, MorphGridProps } from './types';

export interface RowLabels {
  type: string;
  fewer: string;
  more: string;
  remove: string;
  drop: string;
  add: string;
}

const DEFAULT_ROW_LABELS: RowLabels = {
  type: 'Show this row as',
  fewer: 'Fewer slots',
  more: 'More slots',
  remove: 'Remove row',
  drop: 'Drop here',
  add: 'Add…',
};

export interface RowHeaderProps<V extends string = string> {
  row: Row<V>;
  index: number;
  filled: number;
  views: V[];
  labelOf: (view: V) => string;
  maxSlots: number;
  editable: boolean;
  labels: RowLabels;
  setView: (view: V) => void;
  setSlots: (slots: number) => void;
  remove: () => void;
}

export interface SlotProps<T, V extends string = string> {
  row: Row<V>;
  slot: number;
  cellId: string;
  over: boolean;
  // Items not on the grid, in cycle order: what this slot can take without moving anything else.
  offGrid: T[];
  place: (item: T) => void;
  labelOf: (item: T) => string;
  labels: RowLabels;
}

export function DefaultSlot<T, V extends string>(p: SlotProps<T, V>) {
  if (p.over || !p.offGrid.length) return <div className="mg-hint">{p.labels.drop}</div>;
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

export interface RowGridProps<T, V extends string = string>
  extends Omit<MorphGridProps<T, V>, 'cells' | 'layout' | 'renderCell'> {
  rows: Row<V>[];
  onRowsChange?: (rows: Row<V>[]) => void;
  rowLayout?: RowLayoutOptions<V>;
  viewOrder?: V[];
  maxSlots?: number;
  rowLabels?: Partial<RowLabels>;
  renderHeader?: (p: RowHeaderProps<V>) => ReactNode;
  renderSlot?: (p: SlotProps<T, V>) => ReactNode;
  // Which off-grid item a slot added with "+" starts with; false leaves new slots empty.
  fillSlot?: false | ((row: Row<V>, offGrid: T[]) => T | undefined);
}

export function DefaultRowHeader<V extends string>(p: RowHeaderProps<V>) {
  return (
    <div className="mg-rowbar">
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
          <button type="button" aria-label={p.labels.fewer} disabled={p.row.slots <= 1} onClick={() => p.setSlots(p.row.slots - 1)}>−</button>
          <button type="button" aria-label={p.labels.more} disabled={p.row.slots >= p.maxSlots} onClick={() => p.setSlots(p.row.slots + 1)}>+</button>
          <button type="button" aria-label={p.labels.remove} onClick={p.remove}>×</button>
        </span>
      )}
    </div>
  );
}

// A MorphGrid laid out in rows. Each row's header picks one view for all its slots; items move between rows
// by drag, keyboard or cycling, and redraw in the view of the row they land in.
export function RowGrid<T, V extends string>(props: RowGridProps<T, V>) {
  const {
    rows, onRowsChange, rowLayout: layoutOpts, viewOrder, maxSlots = 4, renderHeader, renderSlot, fillSlot,
    value, defaultValue, onChange, onAnnounce, ...rest
  } = props;
  const labels = useMemo(() => ({ ...DEFAULT_ROW_LABELS, ...props.rowLabels }), [props.rowLabels]);
  const cells = useMemo(() => rowCells(rows), [rows]);
  const layout = useMemo(() => rowLayout(rows, layoutOpts), [rows, layoutOpts]);
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

  const views = viewOrder ?? ((typeof props.views === 'function' ? Object.keys(props.viewLabels ?? {}) : Object.keys(props.views)) as V[]);
  const labelOf = (v: V) => props.viewLabels?.[v] ?? v;
  const itemLabel = (item: T) => props.getItemLabel?.(item) ?? props.getItemId(item);
  const byId = useMemo(() => new Map(props.items.map((i) => [props.getItemId(i), i])), [props.items, props.getItemId]);
  const placed = new Set(Object.values(current));
  const offGrid = (props.cycleOrder ?? itemIds).filter((id) => byId.has(id) && !placed.has(id)).map((id) => byId.get(id)!);

  // `fill` lists new slots that should start with an off-grid item.
  const change = (next: Row<V>[], message: string, fill: { row: Row<V>; cellId: string }[] = []) => {
    onRowsChange?.(next);
    const out: Record<string, string | null> = { ...pruneRows(current, next, itemIds) };
    const left = [...offGrid];
    const added: string[] = [];
    for (const { row, cellId } of fill) {
      const item = fillSlot === false ? undefined : fillSlot ? fillSlot(row, left) : left[0];
      if (!item) continue;
      left.splice(left.indexOf(item), 1);
      out[cellId] = props.getItemId(item);
      added.push(itemLabel(item));
    }
    const moves = diff(current, out);
    if (moves.length) commit(out, { reason: 'rows', itemId: moves[0].itemId, moves });
    say(message + (added.length ? ` Added ${added.join(', ')}.` : ''));
  };

  const place = (cellId: string, item: T) => {
    const id = props.getItemId(item);
    const next = { ...current, [cellId]: id };
    commit(next, { reason: 'pick', itemId: id, moves: diff(current, next) });
    say(`Added ${itemLabel(item)}.`);
  };

  const renderCell = (cell: CellDef<V>, state: { over: boolean; empty: boolean }) => {
    const hit = findRow(rows, cell.id);
    if (!hit) return null;
    const { row, index, slot } = hit;
    if (slot !== null) {
      if (!state.empty) return null;
      const p: SlotProps<T, V> = {
        row, slot, cellId: cell.id, over: state.over, offGrid, labelOf: itemLabel, labels,
        place: (item) => place(cell.id, item),
      };
      return renderSlot ? renderSlot(p) : <DefaultSlot {...p} />;
    }
    const header: RowHeaderProps<V> = {
      row,
      index,
      filled: rowSlotIds(row).filter((id) => current[id]).length,
      views,
      labelOf,
      maxSlots,
      editable: !!onRowsChange && !props.disabled,
      labels,
      setView: (view) => change(rows.map((r) => (r.id === row.id ? { ...r, view } : r)), `Row ${index + 1} now shows ${labelOf(view).toLowerCase()}.`),
      setSlots: (slots) => {
        const grown = { ...row, slots };
        const fill = Array.from({ length: Math.max(0, slots - row.slots) }, (_, k) => ({ row: grown, cellId: rowSlotId(grown, row.slots + k) }));
        change(rows.map((r) => (r.id === row.id ? grown : r)), `Row ${index + 1} has ${slots} slot${slots === 1 ? '' : 's'}.`, fill);
      },
      remove: () => change(rows.filter((r) => r.id !== row.id), `Row ${index + 1} removed.`),
    };
    return renderHeader ? renderHeader(header) : <DefaultRowHeader {...header} />;
  };

  return (
    <>
      <MorphGrid<T, V>
        {...rest}
        className={'mg-rows' + (props.className ? ' ' + props.className : '')}
        cells={cells}
        layout={layout}
        value={current}
        onChange={commit}
        onAnnounce={onAnnounce}
        renderCell={renderCell}
      />
      <div className="mg-sr" aria-live="polite" role="status">
        {status}
      </div>
    </>
  );
}
