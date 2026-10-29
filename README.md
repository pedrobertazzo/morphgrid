# morphgrid

**A React grid where the cell decides how an item is shown.**

Most grid libraries move boxes around. morphgrid moves *data* around. Every cell on the grid has a view, like "chart", "big number", "full-page picture" or "pull quote". When you drag an item into a cell, the item is redrawn in that cell's view and resizes to fit as it goes. Whatever was in the target cell slides into the spot you left, and you see the swap before you let go.

It started as a running dashboard, but nothing in it is about dashboards. The demo includes three very different uses:

- **A running dashboard.** Each metric becomes a number, a chart, a sentence or a dot picture, depending on where you drop it.
- **A color board.** Uses named grid areas, has more colors than cells, a locked cell, and a cell that only accepts light colors.
- **A book spread.** Passages of text, some with illustrations, are set as a chapter opener, a column, a full plate, a pull quote or a margin note. An info drawer shows more about each one.

---

## Contents

1. [Concepts](#concepts)
2. [Getting started](#getting-started)
3. [Tutorial: your first grid](#tutorial-your-first-grid)
4. [Layouts](#layouts)
5. [Views and shapes](#views-and-shapes)
6. [State: controlled and uncontrolled](#state-controlled-and-uncontrolled)
7. [Rules: locked cells and accepts](#rules-locked-cells-and-accepts)
8. [More items than cells](#more-items-than-cells)
9. [Rows: a grid people can rearrange](#rows-a-grid-people-can-rearrange)
10. [Opening an item for more detail](#opening-an-item-for-more-detail)
11. [Custom chrome](#custom-chrome)
12. [Accessibility and announcements](#accessibility-and-announcements)
13. [Theming](#theming)
14. [Helpers](#helpers)
15. [The core functions](#the-core-functions)
16. [API reference](#api-reference)
17. [How the interactions behave](#how-the-interactions-behave)
18. [Development](#development)

---

## Concepts

There are four ideas. Once they click, the rest of the API follows.

| Concept | What it is | Example |
| --- | --- | --- |
| **Item** | A piece of your data. Any shape, as long as it has an id. | `{ key: 'dist', title: 'Distance', vals: [...] }` |
| **Cell** | A slot on the grid. It has a position and a **view** key. | `{ id: 'top-left', view: 'chart', area: '1 / 1 / 2 / 3' }` |
| **View** | A React component that draws an item for a kind of cell. | `ChartView`, `NumberView` |
| **Assignment** | Which item is in which cell. This is the grid's entire state. | `{ 'top-left': 'dist', 'side': 'runs' }` |

Dragging, keyboard moves and the "change data" control are all just edits to the assignment. Two items trade places, or an item comes in from off the grid. That's why nothing is ever duplicated or lost.

```
   items  ──┐
            ├──►  assignment { cellId → itemId }  ──►  each cell renders its item with cell.view
   cells  ──┘            ▲
                         └── drag / arrow keys / "change data" swap entries
```

---

## Getting started

morphgrid needs React 18 or newer.

```bash
npm install morphgrid
```

Then import the component and the stylesheet once:

```tsx
import { MorphGrid } from 'morphgrid';
import 'morphgrid/styles.css';
```

To see the demos:

```bash
npm run dev
```

---

## Tutorial: your first grid

We'll build a small grid of three cells that shows team members three ways.

### 1. Describe your items

Items can be any shape. morphgrid only needs to know how to get an id, and optionally a readable label.

```tsx
type Person = { id: string; name: string; role: string; commits: number[] };

const people: Person[] = [
  { id: 'ana', name: 'Ana', role: 'Design', commits: [3, 5, 2, 8] },
  { id: 'ben', name: 'Ben', role: 'Backend', commits: [9, 4, 7, 6] },
  { id: 'cy', name: 'Cy', role: 'Frontend', commits: [1, 6, 6, 9] },
];
```

### 2. Write one component per view

Every view gets the same props. The useful ones are `item`, plus `width`, `height` and `shape` of the cell it's in.

```tsx
import type { ViewProps } from 'morphgrid';

type View = 'card' | 'stat' | 'bars';
type P = ViewProps<Person, View>;

const Card = ({ item }: P) => (
  <div>
    <h3>{item.name}</h3>
    <p>{item.role}</p>
  </div>
);

const Stat = ({ item }: P) => <b style={{ fontSize: 40 }}>{item.commits.reduce((a, b) => a + b, 0)}</b>;

const Bars = ({ item, shape }: P) => (
  <div style={{ display: 'flex', flexDirection: shape === 'tall' ? 'column' : 'row', gap: 4, flex: 1 }}>
    {item.commits.map((c, i) => (
      <i key={i} style={{ flex: c, background: 'var(--mg-accent)' }} />
    ))}
  </div>
);
```

### 3. Lay out the cells

Cells are positioned with CSS grid. Here `area` is a normal `grid-area` value: `row-start / col-start / row-end / col-end`.

```tsx
import type { CellDef } from 'morphgrid';

const cells: CellDef<View>[] = [
  { id: 'main', view: 'bars', area: '1 / 1 / 3 / 3' },
  { id: 'side', view: 'card', area: '1 / 3 / 2 / 4' },
  { id: 'corner', view: 'stat', area: '2 / 3 / 3 / 4' },
];
```

### 4. Render the grid

```tsx
<MorphGrid<Person, View>
  cells={cells}
  items={people}
  getItemId={(p) => p.id}
  getItemLabel={(p) => p.name}
  views={{ card: Card, stat: Stat, bars: Bars }}
  viewLabels={{ card: 'Card', stat: 'Total', bars: 'Commits' }}
  layout={{ columns: 3, rowHeight: 140, gap: 12 }}
/>
```

That's a working grid:

- Drag Ana from the big cell to the corner, and she turns into a number while Cy (or whoever was there) becomes the bar chart.
- Focus a block and press the arrow keys to do the same from the keyboard.
- Hover a block and use **‹ change data ›** to swap in the next person.

Without a `defaultValue`, items fill cells in order. To choose the starting arrangement yourself:

```tsx
defaultValue={{ main: 'ben', side: 'ana', corner: 'cy' }}
```

---

## Layouts

The `layout` prop describes the CSS grid the cells sit in. Any grid you could write in CSS works.

```ts
layout={{
  columns: 4,                 // a number gives equal columns; a string is used as-is ('2fr 1fr 1fr')
  rows: '140px 140px 110px',  // optional explicit rows (a number gives equal rows)
  rowHeight: 150,             // height of implicit rows (grid-auto-rows); a number is px
  gap: 12,                    // number (px) or any CSS gap ('16px 14px')
}}
```

### Named areas

For layouts that read like a picture, use `templateAreas` and give each cell an area *name*:

```ts
const cells = [
  { id: 'hero', view: 'swatch', area: 'hero' },
  { id: 'brand', view: 'code', area: 'brand' },
  { id: 'side', view: 'tints', area: 'side' },
  { id: 'type', view: 'type', area: 'type' },
];

layout={{
  columns: '2fr 1fr 1fr',
  rows: '140px 140px',
  templateAreas: [
    'hero brand side',
    'hero type  side',
  ],
}}
```

A `.` in a template is an empty track. The book demo uses one as the spine between two pages.

### Breakpoints

Breakpoints respond to the **grid's own width**, not the window's, so a grid inside a sidebar adapts correctly. The narrowest matching breakpoint wins, and its settings are merged over the base layout.

```ts
layout={{
  columns: 4,
  rowHeight: 150,
  breakpoints: [
    {
      maxWidth: 700,
      columns: 2,
      rowHeight: 170,
      areas: { main: '1 / 1 / 2 / 3', side: '2 / 1 / 3 / 2' },   // move cells by id
    },
  ],
}}
```

`areas` overrides a cell's `area` by id. You can set it in the base layout too, and it accepts `templateAreas` at a breakpoint.

---

## Views and shapes

`views` can be either:

```tsx
// a component per view key
views={{ number: NumberView, chart: ChartView }}

// or one render function
views={(p) => (p.view === 'number' ? <NumberView {...p} /> : <ChartView {...p} />)}
```

Every view receives `ViewProps`:

| Prop | Meaning |
| --- | --- |
| `item`, `itemId` | The data being shown. |
| `cell`, `view` | The cell it's in and that cell's view key. |
| `width`, `height` | The cell's size in px. |
| `shape` | `'wide'`, `'tall'` or `'square'`, from the cell's aspect ratio. |
| `dragging` | True while this item is being dragged. |

**While dragging, these describe the cell under the pointer**, not the one the item came from. That's what makes the item morph mid-drag.

`shape` is the easy way to adapt. The demos turn a vertical bar chart into horizontal bars in tall cells, and put an image above text in tall cells or beside it in wide ones. The default thresholds are wider than 1.5:1 for `wide` and narrower than 0.8:1 for `tall`. Change them with:

```tsx
shape={{ wide: 2, tall: 0.6 }}
```

For finer control, use `width` and `height` directly. For example, the margin-note view in the book demo only shows a thumbnail when `height > 110`.

Blocks are CSS size containers (`container-type: size`), so views can also use `cqw`, `cqh` and `cqmin` units to scale type with the cell.

---

## State: controlled and uncontrolled

**Uncontrolled** (the grid owns the state): pass `defaultValue`, or nothing at all.

**Controlled** (you own the state): pass `value` and `onChange`. Use this to save layouts, sync them to a server, or undo.

```tsx
const [layout, setLayout] = useState<Assignment>({ main: 'ben', side: 'ana', corner: 'cy' });

<MorphGrid
  value={layout}
  onChange={(next, detail) => {
    setLayout(next);
    console.log(detail.reason, detail.moves);
    // 'drag', [{ itemId: 'ana', from: 'side', to: 'main' }, { itemId: 'ben', from: 'main', to: 'side' }]
  }}
  …
/>
```

`detail.reason` is `'drag'`, `'keyboard'`, `'cycle'` or (in a `RowGrid`) `'rows'`. `detail.itemId` is the item the person acted on, and `detail.moves` lists every item that changed cell. A `to` of `null` means the item left the grid.

The grid tidies up whatever you pass in: unknown cells get `null`, and items that no longer exist (or appear twice) are dropped.

---

## Rules: locked cells and accepts

```ts
{ id: 'brand', view: 'code', locked: true }
```

A **locked** cell keeps its item. The item can't be dragged out, other items can't be dropped in, and cycling skips it.

```ts
{ id: 'light', view: 'code', accepts: (itemId) => isLight(itemId) }
```

**`accepts`** lets a cell refuse items. Rules are checked both ways: if A would swap with B, B must be allowed in A's old cell too.

When you drag over a cell that refuses the item, the cell shows a "refused" style (`[data-refused]`) and the preview springs back home, because that's where a drop would leave the item.

---

## More items than cells

Pass as many items as you like. Extra items wait off the grid, and **‹ change data ›** brings them in:

- If the next item is already on the grid, the two trade places.
- If it's off the grid, it comes in and the current item leaves.

Either way nothing is duplicated, and items a rule forbids are skipped. Cycling follows the order of `items`. Use `cycleOrder={['a', 'c', 'b']}` to change it, or `cycle={false}` to hide the control.

---

## Rows: a grid people can rearrange

A free-form grid is great when you design the layout. When the people using it should rearrange it, a grid made of **rows** is easier to follow: each row has a header that sets one view for everything in it, and a few slots for items.

```
 Numbers ▾   4 of 4                      − + ×
 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │  1,284 │ │    312 │ │    48% │ │     17 │
 └────────┘ └────────┘ └────────┘ └────────┘
 Charts ▾   2 of 2                       − + ×
 ┌───────────────────┐ ┌───────────────────┐
 │  ▁▃▅▇▅▃           │ │  ▂▄▆█▆▄▂          │
 └───────────────────┘ └───────────────────┘
```

Change a row's view from its header and every item in it redraws. Drag an item into another row and it takes that row's view. Add or remove slots, or remove the row, from the buttons on the right.

```tsx
import { RowGrid, type Row } from 'morphgrid';

const [rows, setRows] = useState<Row<View>[]>([
  { id: 'kpis', view: 'number', slots: 4 },
  { id: 'trends', view: 'chart', slots: 2 },
]);

<RowGrid<Metric, View>
  rows={rows}
  onRowsChange={setRows}
  items={metrics}
  getItemId={(m) => m.key}
  views={{ number: NumberView, chart: ChartView, text: TextView }}
  viewLabels={{ number: 'Numbers', chart: 'Charts', text: 'Sentences' }}
  rowLayout={{ height: (v) => (v === 'number' ? 130 : 240) }}
/>
```

`RowGrid` takes every `MorphGrid` prop except `cells`, `layout` and `renderCell`. Without `onRowsChange` the headers are read-only.

**Layout.** Each row is a full-width header line, then its slots side by side on a 12-column grid. Below 720px, slots wrap one per line; set how many fit per line with `rowLayout.narrow.perLine`, which can depend on the view (two big numbers side by side, charts one per line):

```ts
rowLayout={{
  height: (v) => (v === 'number' ? 130 : 240),
  narrow: { maxWidth: 720, perLine: (v) => (v === 'number' ? 2 : 1) },
}}
```

**State.** The assignment uses cell ids `${row.id}-${slot}` (headers are `${row.id}-h` and never hold items). `fillRows(rows, items)` builds one from a list per row, and `rowItems(rows, assignment)` reads it back, which is handy for saving a board to a URL. When a slot or row goes away, the items in it leave the grid and `onChange` fires with `reason: 'rows'`.

**Customizing.** `renderHeader` replaces the header (it receives the row, how many slots are filled, and `setView`, `setSlots` and `remove`); wrap `DefaultRowHeader` to add to it. `renderSlot` draws empty slots. `viewOrder` sets which views the header offers, `maxSlots` caps slots per row (4), and `rowLabels` translates the header's labels.

---

## Opening an item for more detail

```tsx
onOpen={(item, cell) => setSelected(item)}
```

`onOpen` fires on double-click, double-tap or Enter. Use it for a modal, a drawer or a detail route.

The `ItemView` helper renders the item outside the grid in any view, so a detail panel can show "how it looks in every cell" using the same view components:

```tsx
{(['number', 'chart', 'text'] as const).map((v) => (
  <ItemView key={v} item={selected} itemId={selected.key} view={v} views={VIEWS} style={{ height: 160 }} />
))}
```

Custom chrome can trigger the same thing with `open()` (see below). The book demo uses an **i** button for it.

---

## Custom chrome

"Chrome" is the frame around each view. The default draws a title, the view's label, and the **‹ change data ›** control on hover. You have three options:

```tsx
chrome={false}          // bare views: you draw everything
chrome={MyChrome}       // your own frame
labels={{ cycle: 'change colour', cyclePrev: 'Previous colour', cycleNext: 'Next colour' }}   // just reword
```

Your chrome receives everything a view gets, plus:

| Prop | Meaning |
| --- | --- |
| `children` | The rendered view. Put it somewhere. |
| `label`, `viewLabel` | From `getItemLabel` and `viewLabels`. |
| `cycle(dir)` | Swap in the next (`1`) or previous (`-1`) item. |
| `canCycle` | False for locked cells, or when cycling is off. |
| `open()` | Same as double-click: calls `onOpen`. |
| `labels` | The merged label strings. |

```tsx
function MyChrome(p: ChromeProps<Passage, View>) {
  return (
    <div className="frame">
      {p.children}
      <div className="tools" data-mg-nodrag>
        {p.canCycle && (
          <>
            <button data-mg-cycle="prev" aria-label={p.labels.cyclePrev} onClick={() => p.cycle(-1)}>‹</button>
            <button data-mg-cycle="next" aria-label={p.labels.cycleNext} onClick={() => p.cycle(1)}>›</button>
          </>
        )}
        <button onClick={p.open} aria-label={`More about ${p.label}`}>i</button>
      </div>
    </div>
  );
}
```

Two attributes help:

- **`data-mg-nodrag`**: pressing inside this element never starts a drag. Buttons, inputs, selects, textareas, links and contenteditable already behave this way.
- **`data-mg-cycle="next" | "prev"`**: after cycling, the grid moves keyboard focus to this control in the item that just arrived. Keyboard users then stay in the same cell instead of following the old item across the grid.

To style drop targets, `renderCell(cell, { over, empty })` replaces the default `hint` inside each cell.

---

## Accessibility and announcements

Built in:

- Every block is focusable. **Arrow keys** move it to the nearest cell in that direction, and **Enter** opens it.
- Every change is read out through a polite live region, for example *"Distance moved to Picture; Pace moved to Number."*
- Each block has an `aria-label` made of the item's label, its view, and a hint (`labels.blockHint`).
- `prefers-reduced-motion` turns off movement and morph animations.

Announcements use `getItemLabel` for items and, for cells, `cell.name`, then `viewLabels[cell.view]`, then the view key. To word messages yourself, or to show them on screen as well:

```tsx
announce={(detail, describe) =>
  detail.reason === 'cycle' ? `Now showing ${label(detail.itemId)}.` : detail.moves.map(describe).join('; ')
}
onAnnounce={(msg) => setStatusLine(msg)}
```

Return `''` from `announce` to stay quiet.

---

## Theming

Import `morphgrid/styles.css` and override variables on `.mg-grid` (or on your own `className`):

| Variable | Used for |
| --- | --- |
| `--mg-surface` | Block background |
| `--mg-ink` / `--mg-muted` | Text / secondary text |
| `--mg-line` | Borders |
| `--mg-accent` | Focus ring, drop target, view label |
| `--mg-radius` | Corner radius |
| `--mg-pad` | Padding inside the default chrome |
| `--mg-move` / `--mg-resize` / `--mg-ease` | Animation timing |

```css
.book-grid {
  --mg-surface: var(--paper);
  --mg-accent: #9b2c1f;
  --mg-radius: 4px;
}
```

Dark-mode defaults are included. The same variables apply inside `ItemView`.

Useful hooks for your own CSS:

- **Classes:** `.mg-block`, `.mg-dragging`, `.mg-cell`, `.mg-content`.
- **Attributes on cells:** `[data-over]`, `[data-empty]`, `[data-locked]`, `[data-refused]`.
- **Attributes on blocks:** `[data-view]`, `[data-shape]`, `[data-locked]`.

---

## Helpers

### `<FitText>`

Text that grows to the largest size that fits its box. Good for quotes and sentences in cells of any size.

```tsx
<FitText min={12} max={36}>{item.sentence}</FitText>
```

### `<ItemView>`

Renders one item in one view outside the grid, sized by its own box. Its shape is measured just like a cell's.

```tsx
<ItemView item={item} itemId={item.id} view="chart" views={VIEWS} style={{ height: 200 }} />
```

### `<DefaultChrome>`

The default frame, exported so you can wrap or extend it.

---

## The core functions

Everything the grid does is a pure function on an `Assignment`. They're exported, so you can drive a grid from buttons, a server or tests:

```ts
import { placeItem, cycleItem, diff, defaultAssignment } from 'morphgrid';

const a = { main: 'ben', side: 'ana', corner: 'cy' };

const next = placeItem(a, 'ana', 'main')!;   // { main: 'ana', side: 'ben', corner: 'cy' }
diff(a, next);                              // [{ itemId: 'ben', from: 'main', to: 'side' }, { itemId: 'ana', from: 'side', to: 'main' }]
cycleItem(a, 'corner', ['ana', 'ben', 'cy', 'dee'], 1);   // { next: { …, corner: 'dee' }, itemId: 'dee' }
```

| Function | Does |
| --- | --- |
| `placeItem(a, itemId, cellId, canPlace?)` | Puts an item in a cell, swapping with the occupant. Returns `null` if a rule forbids it. |
| `cycleItem(a, cellId, order, dir, canPlace?)` | Brings the next or previous item into a cell. |
| `diff(prev, next)` | Lists the moves between two assignments. |
| `defaultAssignment(cellIds, itemIds)` | Fills cells in order. |
| `normalize(a, cellIds, itemIds)` | Cleans up loose input. |
| `findCell(a, itemId)` | Which cell holds an item. |
| `sameAssignment(a, b)` | Equality check. |
| `getShape(w, h, thresholds?)` | `'wide'`, `'tall'` or `'square'`. |
| `resolveLayout(layout, width)` | Applies breakpoints. |
| `gridStyle(config)` | Turns a layout into CSS grid properties. |
| `hitTest(rects, x, y)` / `findNeighbor(rects, from, dir)` | Geometry used for drag and arrow keys. |
| `findMove(assignment, rects, itemId, dir, canPlace?)` | Where an arrow key sends an item: the nearest cell that way that would take it. |

---

## API reference

### `<MorphGrid>` props

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `cells` | `CellDef<V>[]` | required | The slots. |
| `items` | `T[]` | required | Your data. |
| `getItemId` | `(item) => string` | required | |
| `views` | `{ [view]: Component }` or `(props) => ReactNode` | required | |
| `layout` | `GridLayout` | required | See [Layouts](#layouts). |
| `getItemLabel` | `(item) => string` | the id | Used for titles and announcements. |
| `viewLabels` | `{ [view]: string }` | the view key | |
| `value` / `defaultValue` | `Assignment` | fill in order | Controlled or initial state. |
| `onChange` | `(next, detail) => void` | | |
| `onOpen` | `(item, cell) => void` | | Double-click, double-tap or Enter. |
| `chrome` | `Component` or `false` | `DefaultChrome` | |
| `cycle` | `boolean` | `true` | Show "change data". |
| `cycleOrder` | `string[]` | order of `items` | |
| `shape` | `{ wide, tall }` | `{ 1.5, 0.8 }` | Aspect thresholds. |
| `announce` | `(detail, describe) => string` | "X moved to Y; …" | |
| `onAnnounce` | `(message) => void` | | |
| `renderCell` | `(cell, { over, empty }) => ReactNode` | shows `hint` | |
| `labels` | `Partial<Labels>` | English defaults | `cycle`, `cyclePrev`, `cycleNext`, `blockHint` |
| `longPressMs` | `number` | `230` | Touch hold before dragging. |
| `disabled` | `boolean` | `false` | |
| `className` / `style` | | | Applied to the grid. |

### `CellDef`

| Field | Type | |
| --- | --- | --- |
| `id` | `string` | Required. |
| `view` | `V` | Required. Which view renders items here. |
| `area` | `string` | A `grid-area`, or a name from `templateAreas`. |
| `name` | `string` | Spoken name for announcements. |
| `hint` | `ReactNode` | Shown when the cell is empty or hovered during a drag. |
| `locked` | `boolean` | Keeps its item. |
| `accepts` | `(itemId) => boolean` | Refuse some items. |
| `className` | `string` | |

### `GridLayout`

`columns`, `rows`, `rowHeight`, `gap`, `templateAreas`, `areas`, `breakpoints: { maxWidth, ...any of these }[]`.

### `<RowGrid>` props

Everything `<MorphGrid>` takes except `cells`, `layout` and `renderCell`, plus:

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `rows` | `Row<V>[]` | required | `{ id, view, slots }`. Ids become grid area names: letters, digits, `-`, `_`. |
| `onRowsChange` | `(rows) => void` | | Makes headers editable. |
| `rowLayout` | `RowLayoutOptions<V>` | | `columns` (12), `gap` (12), `height` (200 or per view), `narrow` (`{ maxWidth, columns, perLine, height }` or `false`). |
| `viewOrder` | `V[]` | keys of `views` | Views the header offers. |
| `maxSlots` | `number` | `4` | |
| `renderHeader` | `(p: RowHeaderProps) => ReactNode` | `DefaultRowHeader` | |
| `renderSlot` | `(row, slot, { over, empty }) => ReactNode` | "Drop here" | Empty slots. |
| `rowLabels` | `Partial<RowLabels>` | English defaults | `type`, `fewer`, `more`, `remove`, `drop` |

Row helpers: `rowCells`, `rowLayout`, `rowHeadId`, `rowSlotId`, `rowSlotIds`, `findRow`, `fillRows`, `rowItems`, `pruneRows`.

---

## How the interactions behave

These details came out of the original prototype and are deliberate:

- **Previews are relative to where the drag started.** Wander across five cells and only the one under the pointer is swapped; the others spring back. Nothing gets scrambled.
- **Gaps don't flicker.** With the pointer between cells, the preview holds its last state.
- **Refusing cells spring back.** Over a locked or refusing cell, the preview returns home.
- **Arrow keys go to what lines up.** Down goes to the nearest cell below that overlaps the current one sideways, so it lands in the next row even when a cell farther down sits more directly underneath. Only when nothing lines up does it pick the closest cell by centre.
- **Arrow keys skip what can't take the item.** A locked cell or a row header in the way doesn't stop a keyboard move; the item goes to the nearest cell beyond it that accepts it.
- **Clicks stay clicks.** A mouse drag starts only after 4px of movement, so clicking and double-clicking still work.
- **Touch scrolls.** On touch, a drag starts after a short hold, so a swipe still scrolls the page.
- **Cycling doesn't fly.** Items swapped by "change data" switch in place with a short fade instead of sliding across the grid.
- **The dropped item lands where you see it.** Dropping commits exactly the preview on screen.

---

## Development

```bash
npm run dev          # demo app at demo/
npm test             # unit tests for the core functions
npm run typecheck
npm run build        # library into dist/
npm run build:demo   # static demo into demo-dist/
```

```
src/
  MorphGrid.tsx      the component: measuring, drag, keyboard, rendering
  core.ts            pure assignment, geometry and layout functions
  types.ts           public types
  DefaultChrome.tsx  default frame
  FitText.tsx        auto-sizing text
  ItemView.tsx       render an item outside the grid
  styles.css         base styles and theme variables
demo/
  RunningDemo.tsx    the running dashboard
  PaletteDemo.tsx    the color board
  book/              the book spread
tests/
  core.test.ts
```

The book demo quotes Herman Melville's *Moby-Dick* (1851), which is in the public domain.
