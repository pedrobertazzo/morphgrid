import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export interface FitTextProps {
  children: ReactNode;
  min?: number;
  max?: number;
  className?: string;
  style?: CSSProperties;
}

export function FitText({ children, min = 11, max = 34, className, style }: FitTextProps) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const b = box.current, t = text.current;
    if (!b || !t) return;
    const fit = () => {
      const h = b.clientHeight;
      let lo = min, hi = max;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        t.style.fontSize = mid + 'px';
        if (t.scrollHeight <= h && t.scrollWidth <= b.clientWidth) lo = mid;
        else hi = mid - 1;
      }
      t.style.fontSize = lo + 'px';
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    return () => ro.disconnect();
  }, [children, min, max]);

  return (
    <div ref={box} className="mg-fit" style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', ...style }}>
      <div ref={text} className={className}>
        {children}
      </div>
    </div>
  );
}
