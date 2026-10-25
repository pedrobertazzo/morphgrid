import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FitText, ItemView, MorphGrid, type CellDef, type ChromeProps, type ViewProps } from 'morphgrid';
import { Plate } from './Illustrations';
import { PASSAGES, loc, words, type Passage } from './passages';

type View = 'opener' | 'column' | 'plate' | 'quote' | 'margin';
type P = ViewProps<Passage, View>;

const LABELS: Record<View, string> = {
  opener: 'Chapter opener',
  column: 'Column',
  plate: 'Plate',
  quote: 'Pull quote',
  margin: 'Margin note',
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

function Clipped({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current!;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={ref} className={`pg-clip ${className}`} data-clipped={clipped || undefined}>
      {children}
    </div>
  );
}

function DropCap({ text }: { text: string }) {
  return (
    <p className="pg-prose">
      <span className="pg-cap">{text[0]}</span>
      {text.slice(1)}
    </p>
  );
}

function Opener({ item }: P) {
  return (
    <div className="v-opener">
      <div className="pg-chapter">
        <span>Chapter {ROMAN[item.chapter]}</span>
        <b>{item.chapterTitle}</b>
      </div>
      <Clipped>
        <DropCap text={item.text} />
      </Clipped>
    </div>
  );
}

function Column({ item, shape }: P) {
  const img = item.image;
  return (
    <div className={`v-column ${img ? `has-img img-${shape === 'tall' ? 'top' : 'side'}` : ''}`}>
      {img && (
        <figure>
          <Plate kind={img.kind} alt={img.alt} className="pg-art" />
        </figure>
      )}
      <Clipped>
        <p className="pg-prose">{item.text}</p>
      </Clipped>
    </div>
  );
}

function PlateView({ item }: P) {
  if (!item.image)
    return (
      <div className="v-plate typographic">
        <span className="pg-orn" aria-hidden>❦</span>
        <FitText min={14} max={44} className="pg-pull">
          {item.pull}
        </FitText>
        <span className="pg-orn" aria-hidden>❦</span>
      </div>
    );
  return (
    <figure className="v-plate">
      <Plate kind={item.image.kind} alt={item.image.alt} className="pg-art" />
      <figcaption>{item.image.caption}</figcaption>
    </figure>
  );
}

function Quote({ item }: P) {
  return (
    <blockquote className="v-quote">
      <FitText min={12} max={30} className="pg-pull">
        “{item.pull}”
      </FitText>
      <cite>{loc(item)}</cite>
    </blockquote>
  );
}

function Margin({ item, height }: P) {
  return (
    <aside className="v-margin">
      <div className="pg-mhead">
        {item.image && height > 110 && <Plate kind={item.image.kind} alt="" className="pg-thumb" />}
        <span>{loc(item)}</span>
      </div>
      <Clipped>
        <p>{item.gloss}</p>
      </Clipped>
      <small>
        {words(item)} words{item.image ? ' · illustrated' : ''}
      </small>
    </aside>
  );
}

const VIEWS = { opener: Opener, column: Column, plate: PlateView, quote: Quote, margin: Margin };

function PageChrome(p: ChromeProps<Passage, View>) {
  return (
    <div className="pg-chrome">
      {p.children}
      <div className="pg-tools" data-mg-nodrag>
        <span className="pg-loc">{loc(p.item)} · {p.viewLabel}</span>
        {p.canCycle && (
          <>
            <button type="button" data-mg-cycle="prev" aria-label={p.labels.cyclePrev} onClick={() => p.cycle(-1)}>‹</button>
            <button type="button" data-mg-cycle="next" aria-label={p.labels.cycleNext} onClick={() => p.cycle(1)}>›</button>
          </>
        )}
        <button type="button" className="pg-info" aria-label={`More about ${loc(p.item)}`} onClick={p.open}>i</button>
      </div>
    </div>
  );
}

const CELLS: CellDef<View>[] = [
  { id: 'open', view: 'opener', area: 'open', name: 'the chapter opener', hint: 'Chapter opener' },
  { id: 'plate', view: 'plate', area: 'plate', name: 'the plate', hint: 'Full plate' },
  { id: 'colA', view: 'column', area: 'colA', name: 'the left column', hint: 'Column' },
  { id: 'colB', view: 'column', area: 'colB', name: 'the second column', hint: 'Column' },
  { id: 'quote', view: 'quote', area: 'quote', name: 'the pull quote', hint: 'Pull quote' },
  { id: 'mrg', view: 'margin', area: 'mrg', name: 'the margin', hint: 'Margin note' },
  { id: 'colC', view: 'column', area: 'colC', name: 'the right column', hint: 'Column' },
];

const LAYOUT = {
  columns: '1fr 1fr 36px 1fr 1fr',
  rows: 'repeat(4, 132px)',
  gap: '16px 14px',
  templateAreas: [
    'open open . plate plate',
    'open open . plate plate',
    'colA colB . quote mrg',
    'colA colB . colC colC',
  ],
  breakpoints: [
    {
      maxWidth: 640,
      columns: '1fr 1fr',
      rows: 'repeat(8, 124px)',
      templateAreas: ['open open', 'open open', 'plate plate', 'plate plate', 'colA colB', 'colA colB', 'quote mrg', 'colC colC'],
    },
  ],
};

const START = { open: 'ishmael', plate: 'phantom', colA: 'manhattoes', colB: 'sentinels', quote: 'wedded', mrg: 'vibration', colC: 'carpetbag' };

function Drawer({ id, view, onNavigate, onClose }: { id: string; view: View; onNavigate: (id: string) => void; onClose: () => void }) {
  const i = PASSAGES.findIndex((p) => p.id === id);
  const p = PASSAGES[i];
  const closeRef = useRef<HTMLButtonElement>(null);
  const w = words(p);
  const secs = Math.max(5, Math.round((w / 230) * 60));

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', key);
    return () => {
      removeEventListener('keydown', key);
      back?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="dr-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="dr" role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <header className="dr-bar">
          <div>
            <small>Chapter {ROMAN[p.chapter]} · {p.chapterTitle} · paragraph {p.para}</small>
            <h3 id="dr-title">“{p.pull}”</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose}>Close</button>
        </header>

        <div className="dr-body">
          {p.image && (
            <figure className="dr-fig">
              <Plate kind={p.image.kind} alt={p.image.alt} className="dr-art" />
              <figcaption>
                {p.image.caption}
                <span>Description: {p.image.alt}</span>
              </figcaption>
            </figure>
          )}

          <DropCap text={p.text} />

          <dl className="dr-facts">
            <div><dt>Words</dt><dd>{w}</dd></div>
            <div><dt>Reading time</dt><dd>{secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`}</dd></div>
            <div><dt>Set as</dt><dd>{LABELS[view]}</dd></div>
            <div><dt>Illustrated</dt><dd>{p.image ? 'Yes' : 'No'}</dd></div>
          </dl>

          <p className="dr-gloss">{p.gloss}</p>

          {[
            ['Characters', p.characters],
            ['Places', p.places],
            ['Themes', p.themes],
          ].map(([k, v]) =>
            (v as string[]).length ? (
              <div className="dr-tags" key={k as string}>
                <h4>{k as string}</h4>
                <ul>{(v as string[]).map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ) : null,
          )}

          <h4 className="dr-sub">How it sets in each cell</h4>
          <div className="dr-views">
            {(Object.keys(LABELS) as View[]).map((v) => (
              <div key={v} className={'dr-view' + (v === view ? ' sel' : '')}>
                <small>{LABELS[v]}</small>
                <ItemView item={p} itemId={p.id} view={v} views={VIEWS} className="dr-iv" />
              </div>
            ))}
          </div>
        </div>

        <footer className="dr-nav">
          <button type="button" disabled={i === 0} onClick={() => onNavigate(PASSAGES[i - 1].id)}>‹ Previous passage</button>
          <button type="button" disabled={i === PASSAGES.length - 1} onClick={() => onNavigate(PASSAGES[i + 1].id)}>Next passage ›</button>
        </footer>
      </aside>
    </div>
  );
}

export function BookDemo() {
  const [status, setStatus] = useState('Drag a passage to another spot on the spread. Press i, or double-click, to read more about it.');
  const [value, setValue] = useState<Record<string, string | null>>(START);
  const [open, setOpen] = useState<string | null>(null);

  const viewOf = (id: string): View => {
    const cellId = Object.keys(value).find((k) => value[k] === id);
    return CELLS.find((c) => c.id === cellId)?.view ?? 'column';
  };

  return (
    <section>
      <h2>A book spread</h2>
      <p className="lede">
        Each block is a passage; some carry an engraving. Where you drop a passage decides how it is set: chapter
        opener, column, full plate, pull quote or margin note. Illustrated passages lead with their picture in a plate,
        while the others become a typographic plate.
      </p>
      <p className="status" aria-hidden>{status}</p>
      <div className="book">
        <MorphGrid<Passage, View>
          className="book-grid"
          cells={CELLS}
          items={PASSAGES}
          getItemId={(p) => p.id}
          getItemLabel={(p) => `${loc(p)}, “${p.pull}”`}
          views={VIEWS}
          viewLabels={LABELS}
          layout={LAYOUT}
          value={value}
          onChange={(next) => setValue({ ...next })}
          chrome={PageChrome}
          labels={{ cyclePrev: 'Previous passage', cycleNext: 'Next passage', blockHint: 'Drag or use arrow keys to move. Enter for more.' }}
          onAnnounce={setStatus}
          onOpen={(p) => setOpen(p.id)}
        />
        <div className="book-folio" aria-hidden>
          <span>2</span>
          <span>3</span>
        </div>
      </div>
      {open && <Drawer key={open} id={open} view={viewOf(open)} onNavigate={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}
