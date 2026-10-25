import { FitText, MorphGrid, type CellDef, type ViewProps } from 'morphgrid';

type Color = { id: string; name: string; hex: string };
type View = 'swatch' | 'code' | 'tints' | 'type';
type P = ViewProps<Color, View>;

const COLORS: Color[] = [
  { id: 'ink', name: 'Ink', hex: '#10202A' },
  { id: 'cobalt', name: 'Cobalt', hex: '#2442E0' },
  { id: 'saffron', name: 'Saffron', hex: '#F2C230' },
  { id: 'coral', name: 'Coral', hex: '#E0708A' },
  { id: 'moss', name: 'Moss', hex: '#4F7A3A' },
  { id: 'sky', name: 'Sky', hex: '#8EC5E8' },
  { id: 'clay', name: 'Clay', hex: '#B5653A' },
  { id: 'plum', name: 'Plum', hex: '#5B2A6E' },
  { id: 'mint', name: 'Mint', hex: '#A8E0C2' },
  { id: 'fog', name: 'Fog', hex: '#D9DEE2' },
];

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const fg = (hex: string) => (lum(hex) > 0.6 ? '#10202A' : '#FFFFFF');
const byId = new Map(COLORS.map((c) => [c.id, c]));

const Swatch = ({ item }: P) => (
  <div className="sw" style={{ background: item.hex, color: fg(item.hex) }}><span>{item.name}</span></div>
);
const Code = ({ item }: P) => {
  const n = parseInt(item.hex.slice(1), 16);
  return (
    <div className="code">
      <span className="dot" style={{ background: item.hex }} />
      <FitText max={28}>{item.hex}<br /><small>rgb({n >> 16}, {(n >> 8) & 255}, {n & 255})</small></FitText>
    </div>
  );
};
const Tints = ({ item, shape }: P) => (
  <div className="tints" style={{ flexDirection: shape === 'tall' ? 'column' : 'row' }}>
    {[100, 80, 60, 40, 20].map((p) => (
      <i key={p} style={{ background: `color-mix(in srgb, ${item.hex} ${p}%, white)` }} title={`${p}%`} />
    ))}
  </div>
);
const Type = ({ item }: P) => (
  <div className="type" style={{ background: item.hex, color: fg(item.hex) }}>
    <FitText max={40}>The quick brown fox jumps over the lazy dog.</FitText>
  </div>
);

const CELLS: CellDef<View>[] = [
  { id: 'hero', view: 'swatch', area: 'hero', name: 'the hero swatch', hint: 'Swatch' },
  { id: 'brand', view: 'code', area: 'brand', name: 'brand colour', locked: true },
  { id: 'tints', view: 'tints', area: 'tints', name: 'tints', hint: 'Tints' },
  { id: 'type', view: 'type', area: 'type', name: 'type sample', hint: 'Type sample' },
  { id: 'side', view: 'tints', area: 'side', name: 'side tints', hint: 'Tints' },
  { id: 'light', view: 'code', area: 'light', name: 'light accent', hint: 'Light colours only', accepts: (id) => lum(byId.get(id)!.hex) > 0.6 },
];

const LAYOUT = {
  columns: '2fr 1fr 1fr',
  rows: '140px 140px 110px',
  gap: 10,
  templateAreas: ['hero brand side', 'hero type side', 'tints tints light'],
  breakpoints: [{ maxWidth: 600, columns: '1fr 1fr', rows: 'repeat(5, 120px)', templateAreas: ['hero hero', 'brand side', 'type side', 'tints tints', 'light light'] }],
};

export function PaletteDemo() {
  return (
    <section>
      <h2>A colour board</h2>
      <p className="lede">
        Same component, different grid: named template areas, ten colours in six cells (cycle to pull in the rest), a
        locked brand cell, and a cell that only accepts light colours.
      </p>
      <MorphGrid<Color, View>
        className="pal-grid"
        cells={CELLS}
        items={COLORS}
        getItemId={(c) => c.id}
        getItemLabel={(c) => c.name}
        views={{ swatch: Swatch, code: Code, tints: Tints, type: Type }}
        viewLabels={{ swatch: 'swatch', code: 'code', tints: 'tints', type: 'type' }}
        layout={LAYOUT}
        defaultValue={{ hero: 'cobalt', brand: 'ink', tints: 'coral', type: 'saffron', side: 'moss', light: 'mint' }}
        labels={{ cycle: 'change colour', cyclePrev: 'Previous colour', cycleNext: 'Next colour' }}
      />
    </section>
  );
}
