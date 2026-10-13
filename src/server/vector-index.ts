import { sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db';
import { mapCached } from './map-cache';

/**
 * The map's vectors in memory, for the reads that rank papers by cosine
 * against one of them (the `recommended` sort, a paper's peers). Read-only;
 * only cosine similarity between two vectors of one map is ever read.
 */

/** How long the vectors stay in memory; `setMap` drops them sooner (`map-cache.ts`). */
const VECTORS_TTL_MS = 3_600_000;

/**
 * Every listed paper on one venue's map with a vector, unit length, packed
 * `dims` floats apiece. One per map: each venue's vectors are its own
 * service run's, and a distance between two maps' means nothing.
 */
export interface VectorIndex {
  ids: string[];
  row: Map<string, number>;
  dims: number;
  data: Float32Array;
}

export function vectorIndexes(database: Database = getDb()): Promise<VectorIndex[]> {
  const compute = async (): Promise<VectorIndex[]> => {
    const result = await database.execute<{ kind: string; id: string; vector: number[] }>(sql`
      select p.kind, l.id, p.vector from map_points p join listings l on l.slug = p.slug where p.vector is not null
    `);
    const byKind = Map.groupBy(
      result.rows.filter((r) => r.vector.length > 0),
      (r) => r.kind,
    );
    return [...byKind.values()].map((rows) => {
      const dims = rows[0].vector.length;
      const usable = rows.filter((r) => r.vector.length === dims);
      const data = new Float32Array(usable.length * dims);
      usable.forEach((r, i) => {
        let norm = 0;
        for (const x of r.vector) norm += x * x;
        const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
        for (let k = 0; k < dims; k++) data[i * dims + k] = r.vector[k] * scale;
      });
      return { ids: usable.map((r) => r.id), row: new Map(usable.map((r, i) => [r.id, i])), dims, data };
    });
  };
  return database === getDb() ? mapCached('recommend:vectors', VECTORS_TTL_MS, compute) : compute();
}

/**
 * `source`'s `k` nearest papers by cosine on `index`, nearest first, never
 * itself, only those `keep` accepts; empty when `source` is not on it.
 */
export function nearestIn(
  index: VectorIndex,
  source: string,
  k: number,
  keep: (id: string) => boolean = () => true,
): string[] {
  const i = index.row.get(source);
  if (i === undefined || k <= 0) return [];
  const { data, dims } = index;
  // The best so far, weakest first.
  const best: { j: number; s: number }[] = [];
  for (let j = 0; j < index.ids.length; j++) {
    if (j === i || !keep(index.ids[j])) continue;
    let s = 0;
    for (let d = 0; d < dims; d++) s += data[i * dims + d] * data[j * dims + d];
    if (best.length === k && s <= best[0].s) continue;
    if (best.length === k) best.shift();
    let at = 0;
    while (at < best.length && best[at].s < s) at++;
    best.splice(at, 0, { j, s });
  }
  return best.reverse().map((b) => index.ids[b.j]);
}
