import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { DefaultRowHeader, placeItem, RowGrid, rowSlotIds, type Assignment, type ChromeProps, type Row } from 'morphgrid';
import { autoRows, CAPABILITIES, resolve, ROW_LAYOUT, slotsFor, VIEW_KEYS, type Insight, type ViewKey } from '../../data';
import { renderView } from './views';

const LABELS = Object.fromEntries(Object.entries(CAPABILITIES).map(([k, v]) => [k, v.label])) as Record<ViewKey, string>;
const lower = (v: ViewKey) => LABELS[v].toLowerCase();

interface BoardApi {
  items: Insight[];
  setData: (cellId: string, itemId: string | null) => void;
}

const BoardContext = createContext<BoardApi | null>(null);

// Lists every insight; the ones that would fall back in this row say how they'd be drawn.
function DataOptions({ view, items }: { view: ViewKey; items: Insight[] }) {
  return (
    <>
      {items.map((i) => {
        const r = resolve(i, view);
        return (
          <option key={i.key} value={i.key}>
            {i.title}
            {r.fallback ? ` (as ${lower(r.view)})` : ''}
          </option>
        );
      })}
    </>
  );
}

// A slot: the row decides the type, the card only says which data it holds.
function SlotChrome(p: ChromeProps<Insight, ViewKey>) {
  const api = useContext(BoardContext)!;
  const r = resolve(p.item, p.view);
  return (
    <div className="mg-chrome slotc">
      <div className="mg-head">
        <select className="data" aria-label="Data in this slot" value={p.itemId} onChange={(e) => api.setData(p.cell.id, e.target.value || null)}>
          <DataOptions view={p.view} items={api.items} />
          <option value="">Remove from row</option>
        </select>
      </div>
      {r.fallback && (
        <small className="fb" title={`This data has ${r.reason}, so the ${lower(p.view)} row draws it as ${lower(r.view)}.`}>
          as {lower(r.view)} · {r.reason}
        </small>
      )}
      <div className="mg-body">{p.children}</div>
    </div>
  );
}

export function Board({ insights, onOpen }: { insights: Insight[]; onOpen: (i: Insight) => void }) {
  const suggested = useMemo(() => autoRows(insights), [insights]);
  const [rows, setRows] = useState<Row<ViewKey>[]>(suggested.rows);
  const [value, setValue] = useState<Assignment>(suggested.value);
  const nextId = useRef(rows.length);
  const api = useMemo<BoardApi>(
    () => ({
      items: insights,
      // Picking data already on the board swaps it in, exactly like a drag.
      setData: (cellId, itemId) => setValue((a) => (itemId ? placeItem(a, itemId, cellId) ?? a : { ...a, [cellId]: null })),
    }),
    [insights],
  );
  const byKey = useMemo(() => new Map(insights.map((i) => [i.key, i])), [insights]);
  const kinds = new Set(rows.map((r) => r.view));
  const common = kinds.size === 1 ? [...kinds][0] : '';

  return (
    <BoardContext.Provider value={api}>
      <div className="toolbar">
        <label>
          Every row as
          <select value={common} onChange={(e) => e.target.value && setRows(rows.map((r) => ({ ...r, view: e.target.value as ViewKey })))}>
            {!common && <option value="">mixed</option>}
            {VIEW_KEYS.map((v) => <option key={v} value={v}>{LABELS[v]}</option>)}
          </select>
        </label>
        <label>
          Add a row of
          <select value="" onChange={(e) => e.target.value && setRows([...rows, { id: `r${nextId.current++}`, view: e.target.value as ViewKey, slots: slotsFor(e.target.value as ViewKey) }])}>
            <option value="">…</option>
            {VIEW_KEYS.map((v) => <option key={v} value={v}>{LABELS[v]}</option>)}
          </select>
        </label>
        <button onClick={() => (setRows(suggested.rows), setValue(suggested.value))}>Reset to suggested</button>
        <span className="hint">Each row's header sets how its slots draw. Drag data between rows, or pick it from a slot's title.</span>
      </div>
      <RowGrid<Insight, ViewKey>
        className="auto-grid"
        rows={rows}
        onRowsChange={setRows}
        rowLayout={ROW_LAYOUT}
        items={insights}
        value={value}
        onChange={(next) => setValue(next)}
        getItemId={(i) => i.key}
        getItemLabel={(i) => i.title}
        views={renderView}
        viewLabels={LABELS}
        viewOrder={VIEW_KEYS}
        chrome={SlotChrome}
        cycle={false}
        onOpen={onOpen}
        renderHeader={(h) => {
          const falls = rowSlotIds(h.row).filter((id) => value[id] && resolve(byKey.get(value[id]!)!, h.row.view).fallback).length;
          return (
            <>
              <DefaultRowHeader {...h} />
              {falls > 0 && <small className="rowfb">{falls} drawn differently: they lack what a {lower(h.row.view)} needs</small>}
            </>
          );
        }}
        renderSlot={(p) =>
          p.over ? (
            <span className="emptyslot">Drop to show as {lower(p.row.view)}</span>
          ) : (
            <div className="emptyslot">
              <span>Drag data here, or</span>
              <select aria-label={`Add data to this ${lower(p.row.view)} slot`} value="" onChange={(e) => api.setData(p.cellId, e.target.value)}>
                <option value="">pick data…</option>
                <DataOptions view={p.row.view} items={insights} />
              </select>
            </div>
          )
        }
      />
    </BoardContext.Provider>
  );
}
