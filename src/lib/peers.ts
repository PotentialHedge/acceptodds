/**
 * A paper's peers, for "among peers" on its Stats figure: the papers the
 * similarity service names as related, in its order, then the nearest by the
 * map's vectors, until `PEERS`. Only papers in `field` (the venue's trading,
 * traded papers) count, never the paper itself or one twice. Fewer than
 * `MIN_PEERS` is no field.
 */

export const PEERS = 50;
export const MIN_PEERS = 10;

export function choosePeers(
  self: string,
  related: readonly string[],
  nearest: readonly string[],
  field: ReadonlySet<string>,
  k = PEERS,
): string[] {
  const out = new Set<string>();
  for (const id of [...related, ...nearest]) {
    if (out.size >= k) break;
    if (id !== self && field.has(id)) out.add(id);
  }
  return out.size >= MIN_PEERS ? [...out] : [];
}
