import { toRows } from './adapters';
import { generate } from './insights';
import { profile } from './profile';
import { infer, refine, type SemanticProvider } from './semantics';
import type { Insight, MorphDataset } from './types';

export * from './types';
export { toRows, flatten, parseCSV, jsonAdapter, csvAdapter, type DataAdapter } from './adapters';
export { profile } from './profile';
export { infer, refine, summarize, cacheKey, type SemanticProvider, type SemanticHint, type SchemaSummary } from './semantics';
export { generate, pick, fmt } from './insights';
export { autoRows, slotsFor, facets, fits, resolve, viewsFor, CAPABILITIES, CHAINS, MAX_SLOTS, ROW_LAYOUT, VIEW_KEYS, type ViewKey, type AutoRows, type Resolved } from './grid';

export interface Analysis {
  dataset: MorphDataset;
  insights: Insight[];
}

// Raw input → rows → profile → semantics → ranked insights. No network, no LLM.
export function analyze(input: unknown): Analysis {
  const rows = toRows(input);
  const fields = infer(profile(rows));
  const dataset = { fields, rows };
  return { dataset, insights: generate(dataset) };
}

// Same, but low-confidence fields are sent (as names + stats only) to a provider such as an LLM.
export async function analyzeWith(input: unknown, provider: SemanticProvider, opts?: { withSamples?: boolean }): Promise<Analysis> {
  const rows = toRows(input);
  const fields = await refine(infer(profile(rows)), rows.length, provider, opts);
  const dataset = { fields, rows };
  return { dataset, insights: generate(dataset) };
}
