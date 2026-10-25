import { useEffect, useState } from 'react';
import { FitText, ItemView, MorphGrid, type CellDef, type ViewProps } from 'morphgrid';
import { INI, METRICS, MON, full, stats, type Metric } from './metrics';

type View = 'number' | 'chart' | 'text' | 'picture';
type P = ViewProps<Metric, View>;

const LABELS: Record<View, string> = { number: 'Number', chart: 'Chart', text: 'Text', picture: 'Picture' };

function NumberView({ item: m }: P) {
  const s = stats(m);
  return (
    <>
      <div className="num"><b>{m.big(s.val)}</b><span>{m.unit}</span></div>
      <p className="note">{m.agg === 'sum' ? 'total this year' : m.agg === 'max' ? 'best this year' : 'average this year'}</p>
    </>
  );
}

function ChartView({ item: m, shape }: P) {
  const s = stats(m);
  const cap = m.better === 'low' ? `${shape === 'tall' ? 'Longer' : 'Taller'} is ${m.lowWord}.` : `${MON[s.bi]} was the peak.`;
  if (shape === 'tall')
    return (
      <>
        <div className="hbm">
          {m.vals.map((v, i) => (
            <div className="r" key={i} title={`${MON[i]}: ${full(m, v)}`}>
              <span>{MON[i].slice(0, 3)}</span>
              <div className="t"><i className={i === s.bi ? 'pk' : ''} style={{ width: `${s.norm[i] * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="cap">{cap}</p>
      </>
    );
  return (
    <>
      <div className="vb">
        {m.vals.map((v, i) => (
          <div className="c" key={i} title={`${MON[i]}: ${full(m, v)}`}>
            <div className="w"><i className={i === s.bi ? 'pk' : ''} style={{ height: `${s.norm[i] * 100}%` }} /></div>
            <em>{INI[i]}</em>
          </div>
        ))}
      </div>
      <p className="cap">{cap}</p>
    </>
  );
}

function TextView({ item: m }: P) {
  const s = stats(m);
  return (
    <FitText className="txt">
      {m.lead(full(m, s.val))} {MON[s.bi]} was the {m.hi} at {full(m, m.vals[s.bi])}; {MON[s.wi]} the {m.lo} at{' '}
      {full(m, m.vals[s.wi])}.
    </FitText>
  );
}

function PictureView({ item: m, shape }: P) {
  const s = stats(m);
  const T = shape === 'tall';
  const dots = s.norm.flatMap((n, i) => {
    const k = Math.max(1, Math.round(n * 10));
    return Array.from({ length: 10 }, (_, j) => (
      <circle key={`${i}-${j}`} cx={T ? 5 + j * 10 : 5 + i * 10} cy={T ? 5 + i * 10 : 95 - j * 10} r={3.6}
        fill={j < k ? (i === s.bi ? 'var(--hi)' : 'var(--mg-accent)') : 'var(--mg-line)'} />
    ));
  });
  return (
    <>
      <svg className="pic" viewBox={T ? '0 0 100 120' : '0 0 120 100'} role="img" aria-label={`Dot picture of ${m.title.toLowerCase()} by month`}>
        {dots}
      </svg>
      <p className="cap">Months {T ? 'top to bottom' : 'left to right'}. More dots, more {m.more}.</p>
    </>
  );
}

const VIEWS = { number: NumberView, chart: ChartView, text: TextView, picture: PictureView };

const hint = (v: View, d: string) => (<><b>{LABELS[v]}</b><span>{d}</span></>);
const CELLS: CellDef<View>[] = [
  { id: 'c0', view: 'chart', area: '1/1/2/3', hint: hint('chart', 'month by month') },
  { id: 'c1', view: 'number', area: '1/3/2/4', hint: hint('number', 'one headline figure') },
  { id: 'c2', view: 'text', area: '1/4/3/5', hint: hint('text', 'a plain sentence') },
  { id: 'c3', view: 'chart', area: '2/1/4/2', hint: hint('chart', 'month by month') },
  { id: 'c4', view: 'picture', area: '2/2/4/4', hint: hint('picture', 'one dot per step') },
  { id: 'c5', view: 'picture', area: '3/4/5/5', hint: hint('picture', 'one dot per step') },
  { id: 'c6', view: 'number', area: '4/1/5/2', hint: hint('number', 'one headline figure') },
  { id: 'c7', view: 'text', area: '4/2/5/4', hint: hint('text', 'a plain sentence') },
];

const LAYOUT = {
  columns: 4,
  rowHeight: 150,
  gap: 12,
  breakpoints: [
    {
      maxWidth: 700,
      columns: 2,
      rowHeight: 170,
      areas: { c0: '1/1/2/3', c1: '2/1/3/2', c2: '2/2/4/3', c3: '3/1/5/2', c4: '6/1/8/3', c5: '4/2/6/3', c6: '5/1/6/2', c7: '8/1/9/3' },
    },
  ],
};

const START = { c0: 'runs', c1: 'dist', c2: 'climb', c3: 'hr', c4: 'pace', c5: 'time', c6: 'long', c7: 'cad' };

export function RunningDemo() {
  const [status, setStatus] = useState('Try it: drag the Distance block to another spot.');
  const [open, setOpen] = useState<{ m: Metric; view: View } | null>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [open]);

  return (
    <section>
      <h2>Your year on the road</h2>
      <p className="lede">A port of the original POC. The cell decides the view; drag a block and it morphs to fit. Double-click a block to see every view.</p>
      <p className="status" aria-hidden>{status}</p>
      <MorphGrid<Metric, View>
        className="run-grid"
        cells={CELLS}
        items={METRICS}
        getItemId={(m) => m.key}
        getItemLabel={(m) => m.title}
        views={VIEWS}
        viewLabels={LABELS}
        layout={LAYOUT}
        defaultValue={START}
        onAnnounce={setStatus}
        onOpen={(m, cell) => setOpen({ m, view: cell.view })}
      />
      {open && (
        <div className="ov" role="dialog" aria-modal="true" aria-label={`Every view of ${open.m.title}`} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="ovin">
            <div className="ovbar">
              <h3>Every view of {open.m.title.toLowerCase()}</h3>
              <button type="button" autoFocus onClick={() => setOpen(null)}>Close</button>
            </div>
            <div className="ovgrid">
              <div className="ovcard main">
                <ItemView item={open.m} itemId={open.m.key} view={open.view} views={VIEWS} className="ovview" />
              </div>
              <div className="ovside">
                {(Object.keys(LABELS) as View[]).map((v) => (
                  <button type="button" key={v} className={'ovcard side' + (v === open.view ? ' sel' : '')} aria-pressed={v === open.view} onClick={() => setOpen({ ...open, view: v })}>
                    <small>{LABELS[v]}</small>
                    <ItemView item={open.m} itemId={open.m.key} view={v} views={VIEWS} className="ovview" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
