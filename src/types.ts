import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type { Assignment, GridLayout, Move, Shape, ShapeThresholds } from './core';

export interface CellDef<V extends string = string> {
  id: string;
  view: V;
  area?: string;
  name?: string;
  hint?: ReactNode;
  locked?: boolean;
  accepts?: (itemId: string) => boolean;
  className?: string;
}

export interface ViewProps<T, V extends string = string> {
  item: T;
  itemId: string;
  cell: CellDef<V>;
  view: V;
  width: number;
  height: number;
  shape: Shape;
  dragging: boolean;
}

export type ViewComponent<T, V extends string = string> = ComponentType<ViewProps<T, V>>;
export type Views<T, V extends string> =
  | { [K in V]: ViewComponent<T, V> }
  | ((props: ViewProps<T, V>) => ReactNode);

export interface ChromeProps<T, V extends string = string> extends ViewProps<T, V> {
  label: string;
  viewLabel: string;
  children: ReactNode;
  cycle: (dir: 1 | -1) => void;
  open: () => void;
  canCycle: boolean;
  labels: Labels;
}

export type ChangeReason = 'drag' | 'keyboard' | 'cycle' | 'rows';

export interface ChangeDetail {
  reason: ChangeReason;
  itemId: string;
  moves: Move[];
}

export interface Labels {
  cycle: string;
  cyclePrev: string;
  cycleNext: string;
  blockHint: string;
}

export interface MorphGridProps<T, V extends string = string> {
  cells: CellDef<V>[];
  items: T[];
  getItemId: (item: T) => string;
  getItemLabel?: (item: T) => string;
  views: Views<T, V>;
  viewLabels?: Partial<Record<V, string>>;
  layout: GridLayout;

  value?: Assignment;
  defaultValue?: Assignment;
  onChange?: (next: Assignment, detail: ChangeDetail) => void;

  chrome?: ComponentType<ChromeProps<T, V>> | false;
  cycle?: boolean;
  cycleOrder?: string[];
  shape?: ShapeThresholds;
  onOpen?: (item: T, cell: CellDef<V>) => void;
  announce?: (detail: ChangeDetail, describe: (m: Move) => string) => string;
  onAnnounce?: (message: string) => void;
  renderCell?: (cell: CellDef<V>, state: { over: boolean; empty: boolean }) => ReactNode;
  disabled?: boolean;
  longPressMs?: number;
  labels?: Partial<Labels>;
  className?: string;
  style?: CSSProperties;
}
