import { useMemo, useState } from 'react';
import { ItemView } from 'morphgrid';
import { analyze, cacheKey, CAPABILITIES, summarize, viewsFor, type Analysis, type Insight, type ViewKey } from '../../data';
import { CORPUS } from '../../data/corpus';
import { Board } from './Board';
import { VIEWS } from './views';

const LABELS = Object.fromEntries(Object.entries(CAPABILITIES).map(([k, v]) => [k, v.label])) as Record<ViewKey, string>;

function run(input: unknown): Analysis | string {
  try {
    const a = analyze(input);
    return a.dataset.rows.length ? a : 'No records found in that input.';
  } catch (e) {
    return (e as Error).message;
  }
}

export function AutoDemo() {
  const [source, setSource] = useState(() => new URLSearchParams(location.search).get('d') ?? CORPUS[0].id);
  const [text, setText] = useState('');
  const [custom, setCustom] = useState<unknown>(null);
  const [selected, setSelected] = useState<Insight | null>(null);

  const ds = CORPUS.find((d) => d.id === source);
  const result = useMemo(() => run(source === 'custom' ? custom : ds!.data), [source, custom, ds]);
  const analysis = typeof result === 'string' ? null : result;
  const summary = analysis && summarize(analysis.dataset.fields, analysis.dataset.rows.length);
  const uncertain = analysis?.dataset.fields.filter((f) => f.role !== 'ignore' && f.confidence < 0.75) ?? [];

  const load = (raw: string) => {
    setText(raw);
    const t = raw.trim();
    try {
      setCustom(/^[[{]/.test(t) ? JSON.parse(t) : t);
    } catch (e) {
      setCustom(t);
    }
    setSource('custom');
  };

  return (
    <main className="auto">
      <h1>morphgrid · auto</h1>
      <p className="lede">
        Give it data it has never seen. It profiles the fields, guesses what they mean, turns them into insights, and fills the
        board. The board is made of rows: each row's header sets one type (numbers, bars, lines…) for all its slots. Change a
        row's type there, or drag data into the row that draws it the way you want. When data lacks what a row needs (a
        scatter, but no x/y pairs), it's drawn the closest way it can, and the card says so. Double-click a card to see
        every form it can take.
      </p>

      <div className="chips" role="tablist">
        {CORPUS.map((d) => (
          <button key={d.id} role="tab" aria-selected={source === d.id} onClick={() => setSource(d.id)}>{d.name}</button>
        ))}
        <button role="tab" aria-selected={source === 'custom'} onClick={() => setSource('custom')}>Your data</button>
      </div>

      {source === 'custom' ? (
        <div className="paste">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Paste a JSON array of objects, an API response, or CSV with a header row.'}
            spellCheck={false}
          />
          <div className="row">
            <button onClick={() => load(text)}>Analyze</button>
            <label className="file">
              or open a .json / .csv file
              <input type="file" accept=".json,.csv,.tsv,.txt" onChange={(e) => e.target.files?.[0]?.text().then(load)} />
            </label>
            {typeof result === 'string' && custom != null && <span className="err">{result}</span>}
          </div>
        </div>
      ) : (
        <p className="status">{ds?.note}</p>
      )}

      {analysis && (
        <>
          <Board key={`${source}:${text.length}`} insights={analysis.insights} onOpen={setSelected} />

          <div className="panels">
            <section>
              <h2>What it understood</h2>
              <p className="lede">{analysis.dataset.rows.length.toLocaleString()} rows. Deterministic rules only; no network.</p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Field</th><th>Type</th><th>Role</th><th>Unit</th><th>Agg</th><th>Conf.</th><th>Why</th></tr>
                  </thead>
                  <tbody>
                    {analysis.dataset.fields.map((f) => (
                      <tr key={f.id} className={f.role === 'ignore' ? 'dim' : f.confidence < 0.75 ? 'warn' : ''}>
                        <td><code>{f.id}</code></td>
                        <td>{f.physical}{f.time ? ` (${f.time.source})` : ''}</td>
                        <td><span className={`role r-${f.role}`}>{f.role}</span></td>
                        <td>{f.role === 'measure' ? f.unit ?? '?' : ''}</td>
                        <td>{f.role === 'measure' ? f.agg : ''}</td>
                        <td>{Math.round(f.confidence * 100)}%</td>
                        <td className="why">{f.reasons.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>Ranked insights</h2>
              <p className="lede">{analysis.insights.length} candidates. The board starts with a varied selection, grouped into rows by the chart each one suits.</p>
              <ol className="ranked">
                {analysis.insights.map((i) => {
                  return (
                    <li key={i.key}>
                      <button onClick={() => setSelected(i)}>
                        <span className="sc"><i style={{ width: `${Math.min(1, i.score) * 100}%` }} /></span>
                        <b>{i.title}</b>
                        <small>{i.kind} · {i.explain}</small>
                        <span className="vs">{viewsFor(i).map((v) => <em key={v}>{LABELS[v]}</em>)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>

          <details className="llm">
            <summary>
              Optional LLM step: {uncertain.length ? `${uncertain.length} uncertain field${uncertain.length > 1 ? 's' : ''} would be sent` : 'nothing uncertain, no call needed'}
            </summary>
            <p className="lede">
              Only names and statistics leave the machine. Sample values are opt-in. Answers are cached by schema, so the
              same shape of data never asks twice. Cache key: <code>{summary && cacheKey(summary)}</code>
            </p>
            <pre>{JSON.stringify(summary, null, 2)}</pre>
          </details>
        </>
      )}

      {selected && (
        <div className="ov" onClick={() => setSelected(null)}>
          <div className="ovin" onClick={(e) => e.stopPropagation()}>
            <div className="ovbar">
              <h3>{selected.title} <small>{selected.explain}</small></h3>
              <button onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="every">
              {viewsFor(selected).map((v) => (
                <div key={v} className="ovcard">
                  <small>{LABELS[v]}</small>
                  <ItemView item={selected} itemId={selected.key} view={v} views={VIEWS} className="ovview" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
