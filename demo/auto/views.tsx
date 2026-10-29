import type { CSSProperties } from 'react';
import { FitText, type ViewProps } from 'morphgrid';
import { binLabel, fmt } from '../../data/insights';
import type { Insight } from '../../data/types';
import { resolve, type ViewKey } from '../../data/grid';

type P = ViewProps<Insight, ViewKey>;

const COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)'];

function NumberView({ item }: P) {
  return (
    <>
      <div className="num"><b>{item.display}</b></div>
      <p className="note">{item.unit}</p>
    </>
  );
}

function BarsView({ item, shape }: P) {
  const max = Math.max(...item.series.map((e) => Math.abs(e.value)), 1e-9);
  if (shape === 'tall')
    return (
      <div className="hb">
        {item.series.map((e, i) => (
          <div className="r" key={i} title={`${e.label}: ${e.display}`}>
            <span>{e.label}</span>
            <div className="t"><i className={i === 0 ? 'pk' : ''} style={{ width: `${(Math.abs(e.value) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="vb2">
      {item.series.map((e, i) => (
        <div className="c" key={i} title={`${e.label}: ${e.display}`}>
          <small>{e.display}</small>
          <div className="w"><i className={i === 0 ? 'pk' : ''} style={{ height: `${(Math.abs(e.value) / max) * 100}%` }} /></div>
          <em>{e.label}</em>
        </div>
      ))}
    </div>
  );
}

function ListView({ item, height }: P) {
  const rows = Math.max(2, Math.floor((height - 60) / 34));
  const max = Math.max(...item.series.map((e) => Math.abs(e.value)), 1e-9);
  return (
    <ol className="list">
      {item.series.slice(0, rows).map((e, i) => (
        <li key={i}>
          {e.image && <img src={e.image} alt="" loading="lazy" />}
          <span className="l">{e.label}</span>
          <b>{e.display}</b>
          <i style={{ width: `${(Math.abs(e.value) / max) * 100}%` }} />
        </li>
      ))}
    </ol>
  );
}

// Drawn in a 100×100 box stretched to the card; strokes keep their width, labels are plain HTML.
// Nothing is measured, so the chart follows the card through every resize and morph.
function LineView({ item }: P) {
  const t = item.trend!;
  const all = t.lines.flatMap((l) => l.values).filter((v): v is number => v != null);
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i: number) => (i / Math.max(1, t.t.length - 1)) * 100;
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * 92;
  const path = (vs: (number | null)[]) =>
    vs.map((v, i) => (v == null ? '' : `${i && vs[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`)).join('');
  return (
    <div className="plot">
      <div className="area">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={item.line}>
          <line x1={0} x2={100} y1={100} y2={100} className="ax" vectorEffect="non-scaling-stroke" />
          {t.lines.map((l, i) => (
            <path key={l.name} d={path(l.values)} fill="none" stroke={COLORS[i % 8]} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <span className="tick top">{fmt(hi, item.measureUnit)}</span>
      </div>
      <div className="ticks">
        <span>{binLabel(t.t[0], t.bin)}</span>
        <span>{binLabel(t.t[t.t.length - 1], t.bin)}</span>
      </div>
      {t.lines.length > 1 && <Legend names={t.lines.map((l) => l.name)} />}
    </div>
  );
}

function Legend({ names }: { names: string[] }) {
  return (
    <div className="legend">
      {names.map((n, i) => (
        <span key={n}><i style={{ background: COLORS[i % 8] }} />{n}</span>
      ))}
    </div>
  );
}

function ScatterView({ item }: P) {
  const p = item.points!;
  const xs = p.data.map((d) => d.x), ys = p.data.map((d) => d.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const smax = Math.max(...p.data.map((d) => d.size ?? 0), 1e-9);
  const groups = [...new Set(p.data.map((d) => d.group).filter(Boolean))] as string[];
  const r = (s?: number) => (p.size && s != null ? 5 + Math.sqrt(Math.max(0, s) / smax) * 16 : 7);
  // Geo points keep their aspect ratio so the shape of the map survives.
  const field: CSSProperties | undefined = p.geo ? ({ '--r': (x1 - x0 || 1) / (y1 - y0 || 1) } as CSSProperties) : undefined;
  return (
    <div className="plot">
      <div className="area scatter" role="img" aria-label={item.line}>
        <div className={'field' + (p.geo ? ' geo' : '')} style={field}>
          {p.data.map((d, i) => (
            <i
              key={i}
              title={`${d.label ? d.label + ': ' : ''}${p.x} ${d.x}, ${p.y} ${d.y}${p.size ? `, ${p.size} ${d.size}` : ''}`}
              style={{
                left: `${((d.x - x0) / (x1 - x0 || 1)) * 100}%`,
                top: `${(1 - (d.y - y0) / (y1 - y0 || 1)) * 100}%`,
                width: r(d.size),
                height: r(d.size),
                background: d.group ? COLORS[groups.indexOf(d.group) % 8] : 'var(--mg-accent)',
              }}
            />
          ))}
        </div>
      </div>
      <div className="ticks">
        <span>{p.x} →</span>
        <span>↑ {p.y}{p.size ? ` · size: ${p.size}` : ''}</span>
      </div>
      {groups.length > 1 && <Legend names={groups} />}
    </div>
  );
}

// One dot per entry on a shared value axis: what a scatter cell draws when there are no x/y pairs.
function DotsView({ item, height }: P) {
  const rows = item.series.slice(0, Math.max(3, Math.floor((height - 70) / 22)));
  const vs = rows.map((e) => e.value);
  const lo = Math.min(0, ...vs), hi = Math.max(...vs, lo + 1e-9);
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="dots">
      {rows.map((e, i) => (
        <div className="r" key={i} title={`${e.label}: ${e.display}`}>
          <span>{e.label}</span>
          <div className="t">
            <i style={{ left: at(e.value) }} className={i === 0 ? 'pk' : ''} />
          </div>
          <b>{e.display}</b>
        </div>
      ))}
    </div>
  );
}

function TextView({ item }: P) {
  return <FitText className="txt" max={26}>{item.line}</FitText>;
}

function ProgressView({ item }: P) {
  const pr = item.progress!;
  const f = Math.max(0, Math.min(1, pr.value / (pr.max || 1)));
  const R = 40, C = 2 * Math.PI * R;
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={pr.label}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--mg-line)" strokeWidth="10" />
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--mg-accent)" strokeWidth="10" strokeDasharray={`${f * C} ${C}`} transform="rotate(-90 50 50)" strokeLinecap="round" />
        <text x="50" y="56" textAnchor="middle" className="ringv">{Math.round(f * 100)}%</text>
      </svg>
      <p className="note">{pr.label}</p>
    </div>
  );
}

export const VIEWS: Record<ViewKey, (p: P) => JSX.Element> = {
  number: NumberView,
  bars: BarsView,
  list: ListView,
  line: LineView,
  scatter: ScatterView,
  dots: DotsView,
  text: TextView,
  progress: ProgressView,
};

// The grid's renderer: draws the cell's view, or the first fallback the item supports.
// While dragging, p.view is the cell under the pointer, so the preview already shows the fallback.
export function renderView(p: P) {
  const { view } = resolve(p.item, p.view);
  const View = VIEWS[view];
  return <View {...p} view={view} />;
}
