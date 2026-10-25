import type { ChromeProps } from './types';

export function DefaultChrome<T, V extends string>(p: ChromeProps<T, V>) {
  return (
    <div className="mg-chrome">
      <div className="mg-head">
        <span className="mg-title">{p.label}</span>
        <small className="mg-viewlabel">{p.viewLabel}</small>
      </div>
      <div className="mg-body">{p.children}</div>
      {p.canCycle && (
        <div className="mg-cycle" data-mg-nodrag>
          <button type="button" data-mg-cycle="prev" aria-label={p.labels.cyclePrev} onClick={() => p.cycle(-1)}>
            ‹
          </button>
          <span>{p.labels.cycle}</span>
          <button type="button" data-mg-cycle="next" aria-label={p.labels.cycleNext} onClick={() => p.cycle(1)}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
