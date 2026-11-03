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
  // The view this item showed before its latest morph, so a view can animate from it. Undefined on first show.
  from?: V;
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

export interface CellState {
  over: boolean;
  empty: boolean;
  // A drag is on and `suggest` says this cell suits the dragged item.
  suggested: boolean;
}

export type ChangeReason = 'drag' | 'keyboard' | 'cycle' | 'rows' | 'pick';

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
  renderCell?: (cell: CellDef<V>, state: CellState) => ReactNode;
  // While dragging, cells this returns true for are marked as a good fit (data-suggested) for the dragged item.
  suggest?: (item: T, cell: CellDef<V>) => boolean;
  // Content for each of the layout's bands (see GridConfig.bands), drawn behind the cells.
  renderBand?: (id: string) => ReactNode;
  disabled?: boolean;
  longPressMs?: number;
  autoScroll?: boolean;
  labels?: Partial<Labels>;
  className?: string;
  style?: CSSProperties;
}
