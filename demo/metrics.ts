export const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const INI = 'JFMAMJJASOND';
const mmss = (s: number) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
const nf = (v: number) => Math.round(v).toLocaleString('en-US');
const f1 = (v: number) => v.toFixed(1);

export interface Metric {
  key: string; title: string; unit: string;
  agg: 'sum' | 'avg' | 'max'; better: 'high' | 'low'; lowWord?: string;
  hi: string; lo: string; more: string;
  big: (v: number) => string; lead: (t: string) => string;
  vals: number[];
}

export const METRICS: Metric[] = [
  { key: 'dist', title: 'Distance', unit: 'km', agg: 'sum', better: 'high', hi: 'biggest month', lo: 'smallest', more: 'distance', big: nf, lead: (t) => `You ran ${t} this year.`, vals: [96,110,142,160,178,190,172,168,181,176,140,129] },
  { key: 'runs', title: 'Runs', unit: 'runs', agg: 'sum', better: 'high', hi: 'busiest month', lo: 'quietest', more: 'runs', big: nf, lead: (t) => `You logged ${t} this year.`, vals: [12,13,15,16,20,21,18,17,19,16,12,8] },
  { key: 'pace', title: 'Pace', unit: '/km', agg: 'avg', better: 'low', lowWord: 'faster', hi: 'fastest month', lo: 'slowest', more: 'speed', big: mmss, lead: (t) => `Your average pace was ${t} this year.`, vals: [337,333,330,325,322,318,320,317,313,315,319,323] },
  { key: 'climb', title: 'Climb', unit: 'm', agg: 'sum', better: 'high', hi: 'steepest month', lo: 'flattest', more: 'climbing', big: nf, lead: (t) => `You climbed ${t} this year.`, vals: [420,510,780,960,1210,1380,1250,1190,1320,1450,640,520] },
  { key: 'time', title: 'Time', unit: 'h', agg: 'sum', better: 'high', hi: 'longest month', lo: 'shortest', more: 'time on your feet', big: f1, lead: (t) => `You spent ${t} running this year.`, vals: [9.0,10.2,13.0,14.4,15.9,16.8,15.3,14.8,15.7,15.4,12.4,11.6] },
  { key: 'long', title: 'Longest', unit: 'km', agg: 'max', better: 'high', hi: 'best month', lo: 'shortest', more: 'distance', big: f1, lead: (t) => `Your longest run this year was ${t}.`, vals: [14,15,18,19,22,24,21,20,26,32.4,18,16] },
  { key: 'hr', title: 'Heart rate', unit: 'bpm', agg: 'avg', better: 'low', lowWord: 'calmer', hi: 'calmest month', lo: 'hardest', more: 'efficiency', big: nf, lead: (t) => `Your average heart rate was ${t} this year.`, vals: [152,151,150,149,148,147,149,148,146,147,150,152] },
  { key: 'cad', title: 'Cadence', unit: 'spm', agg: 'avg', better: 'high', hi: 'quickest month', lo: 'slowest', more: 'cadence', big: nf, lead: (t) => `Your average cadence was ${t} this year.`, vals: [168,169,169,170,171,172,171,172,173,172,171,170] },
];

export function stats(m: Metric) {
  const v = m.vals, mx = Math.max(...v), mn = Math.min(...v);
  const tot = v.reduce((a, b) => a + b, 0);
  const val = m.agg === 'sum' ? tot : m.agg === 'max' ? mx : tot / v.length;
  const bi = v.indexOf(m.better === 'high' ? mx : mn);
  const wi = v.indexOf(m.better === 'high' ? mn : mx);
  const norm = v.map((x) => (!mx || mx === mn ? 0.6 : m.better === 'high' ? x / mx : 1 - ((x - mn) / (mx - mn)) * 0.8));
  return { val, bi, wi, norm };
}
export const full = (m: Metric, v: number) => `${m.big(v)} ${m.unit}`;
