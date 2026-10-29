export type Row = Record<string, unknown>;

export type PhysicalType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'null';

export type Role =
  | 'measure'
  | 'dimension'
  | 'temporal'
  | 'identifier'
  | 'label'
  | 'text'
  | 'image'
  | 'url'
  | 'lat'
  | 'lng'
  | 'ignore';

export type Agg = 'sum' | 'mean';
export type TimeSource = 'iso' | 'epoch-ms' | 'epoch-s' | 'year' | 'dmy' | 'mdy';

export interface FieldProfile {
  id: string;
  name: string;
  physical: PhysicalType;
  count: number;
  nulls: number;
  distinct: number;
  cardinality: 'low' | 'medium' | 'high' | 'unique';
  numeric?: { min: number; max: number; minPositive: number; mean: number; std: number; integer: boolean };
  time?: { min: number; max: number; source: TimeSource };
  avgLength?: number;
  samples: unknown[];
}

export interface Field extends FieldProfile {
  role: Role;
  unit?: string;
  agg: Agg;
  concept?: string;
  confidence: number;
  reasons: string[];
}

export interface MorphDataset {
  fields: Field[];
  rows: Row[];
}

export interface Entry {
  label: string;
  value: number;
  display: string;
  image?: string | null;
}

export interface Point {
  x: number;
  y: number;
  size?: number;
  group?: string;
  label?: string;
}

export interface Trend {
  bin: 'hour' | 'day' | 'month' | 'year';
  t: number[];
  lines: { name: string; values: (number | null)[] }[];
}

export interface Scatter {
  x: string;
  y: string;
  size?: string;
  group?: string;
  geo?: boolean;
  data: Point[];
}

export type InsightKind = 'top' | 'breakdown' | 'trend' | 'relation' | 'geo' | 'count';

export type Facet = 'value' | 'series' | 'trend' | 'points' | 'progress' | 'line' | 'image';

export interface Insight {
  key: string;
  title: string;
  kind: InsightKind;
  value: number;
  display: string;
  unit: string;
  // Unit of the measure behind the numbers (e.g. "°C", "$", "min"), for axis labels.
  measureUnit?: string;
  series: Entry[];
  trend?: Trend;
  points?: Scatter;
  progress?: { value: number; max: number; label: string };
  line: string;
  image?: string | null;
  score: number;
  explain: string;
  fields: string[];
}
