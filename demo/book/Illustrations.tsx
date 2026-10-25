import { useId } from 'react';
import type { Illustration } from './passages';

type Props = { kind: Illustration; alt: string; className?: string; fit?: 'cover' | 'contain' };

export function Plate({ kind, alt, className, fit = 'cover' }: Props) {
  const id = useId().replace(/:/g, '');
  const Art = ART[kind];
  return (
    <svg
      className={className}
      viewBox="0 0 200 140"
      preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      role="img"
      aria-label={alt}
    >
      <defs>
        <pattern id={`h${id}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
        <pattern id={`x${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="200" height="140" fill="var(--paper)" />
      <g fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
        <Art h={`url(#h${id})`} x={`url(#x${id})`} />
      </g>
    </svg>
  );
}

const waves = (y0: number, rows: number, amp = 2) =>
  Array.from({ length: rows }, (_, r) => {
    const y = y0 + r * (5 + r * 0.6);
    let d = `M-5 ${y}`;
    for (let x = -5; x < 210; x += 12) d += ` q6 ${-amp - r * 0.3} 12 0`;
    return <path key={r} d={d} strokeWidth={0.5 + r * 0.08} />;
  });

const ART: Record<Illustration, (p: { h: string; x: string }) => JSX.Element> = {
  sea: ({ h }) => (
    <>
      <rect x="0" y="0" width="200" height="72" fill={h} stroke="none" opacity="0.35" />
      <circle cx="140" cy="74" r="20" fill="var(--paper)" />
      {[24, 28, 32].map((r) => <path key={r} d={`M${140 - r} 74 a${r} ${r} 0 0 1 ${2 * r} 0`} strokeWidth="0.4" />)}
      <line x1="0" y1="74" x2="200" y2="74" />
      {waves(80, 10)}
      <g transform="translate(46 62)">
        <path d="M0 12 h26 l-4 5 h-18 z" fill="var(--paper)" />
        <line x1="13" y1="12" x2="13" y2="-6" />
        <path d="M13 -5 q8 6 0 15" fill="var(--paper)" />
        <path d="M13 -4 q-7 6 0 14" fill="var(--paper)" />
      </g>
    </>
  ),
  city: ({ h }) => (
    <>
      <rect x="0" y="0" width="200" height="140" fill="none" />
      {[[8, 40, 18], [28, 28, 14], [44, 50, 20], [66, 34, 12], [80, 46, 22], [104, 24, 14], [120, 38, 18], [140, 52, 16], [158, 30, 20], [180, 44, 16]].map(([x, h0, w], i) => (
        <g key={i}>
          <rect x={x} y={88 - h0} width={w} height={h0} fill="var(--paper)" />
          <rect x={x} y={88 - h0} width={w} height={h0} fill={h} stroke="none" opacity="0.5" />
        </g>
      ))}
      <path d="M52 38 v-14 l3 -6 l3 6 v14" fill="var(--paper)" />
      <rect x="0" y="88" width="200" height="8" fill="var(--paper)" />
      {Array.from({ length: 34 }, (_, i) => <line key={i} x1={i * 6} y1="88" x2={i * 6} y2="100" strokeWidth="0.6" />)}
      {waves(104, 7, 1.5)}
      {[30, 92, 150].map((x, i) => (
        <g key={i} transform={`translate(${x} 0)`}>
          <path d="M-14 96 h30 l-5 6 h-20 z" fill="var(--paper)" />
          <line x1="-4" y1="96" x2="-4" y2="40" />
          <line x1="8" y1="96" x2="8" y2="50" />
          <line x1="-12" y1="50" x2="4" y2="50" />
          <line x1="2" y1="60" x2="14" y2="60" />
          <path d="M-4 42 L-14 96 M-4 42 L14 96 M8 52 L16 96" strokeWidth="0.3" />
        </g>
      ))}
    </>
  ),
  sentinels: ({ h }) => (
    <>
      <rect x="0" y="0" width="200" height="66" fill={h} stroke="none" opacity="0.25" />
      <line x1="0" y1="66" x2="200" y2="66" />
      {waves(70, 4, 1.2)}
      <rect x="0" y="92" width="200" height="48" fill="var(--paper)" />
      <rect x="0" y="92" width="200" height="48" fill={h} stroke="none" opacity="0.4" />
      <line x1="0" y1="92" x2="200" y2="92" strokeWidth="1.2" />
      {Array.from({ length: 13 }, (_, i) => {
        const x = 12 + i * 14.5 + (i % 3) * 2;
        const s = 0.85 + ((i * 37) % 5) * 0.06;
        return (
          <g key={i} transform={`translate(${x} 92) scale(${s})`} fill="var(--paper)">
            <circle cx="0" cy="-30" r="3.2" />
            <path d="M-4 -26 h8 l1.5 14 h-11 z" />
            <path d="M-2.5 -12 v12 M2.5 -12 v12" />
            {i % 4 === 1 && <path d="M-4 -33 h8 l-1 -3 h-6 z" fill="currentColor" />}
          </g>
        );
      })}
    </>
  ),
  phantom: ({ h, x }) => (
    <>
      <rect x="0" y="0" width="200" height="140" fill={x} stroke="none" opacity="0.55" />
      <rect x="0" y="0" width="200" height="140" fill={h} stroke="none" opacity="0.3" />
      <path
        d="M30 98 C40 52 92 34 132 46 C158 54 172 72 176 92 C150 88 120 96 30 98 Z"
        fill="var(--paper)"
        strokeWidth="1"
      />
      <path d="M60 80 q30 -14 70 -10" strokeWidth="0.4" />
      <path d="M70 88 q40 -10 80 -6" strokeWidth="0.4" />
      <circle cx="150" cy="74" r="1.4" fill="currentColor" />
      <path d="M118 44 q-4 -18 -12 -26 M118 44 q2 -18 10 -28 M118 44 q-1 -14 0 -30" strokeWidth="0.6" />
      <rect x="0" y="96" width="200" height="44" fill="var(--paper)" stroke="none" />
      {waves(98, 9, 2.5)}
    </>
  ),
  bag: ({ h }) => (
    <>
      <ellipse cx="100" cy="122" rx="62" ry="6" fill={h} stroke="none" opacity="0.5" />
      <path d="M78 46 q22 -30 44 0" strokeWidth="3" />
      <path d="M78 46 q22 -30 44 0" stroke="var(--paper)" strokeWidth="1.2" />
      <path d="M48 52 h104 l8 66 h-120 z" fill="var(--paper)" strokeWidth="1.1" />
      <rect x="48" y="46" width="104" height="9" rx="2" fill="var(--paper)" />
      <g strokeWidth="0.5">
        {Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => {
            const cx = 62 + c * 16 + (r % 2) * 8;
            const cy = 66 + r * 11;
            return <path key={`${r}-${c}`} d={`M${cx} ${cy - 4} l4 4 l-4 4 l-4 -4 z`} />;
          }),
        )}
      </g>
      <rect x="94" y="52" width="12" height="7" fill="currentColor" />
    </>
  ),
};
