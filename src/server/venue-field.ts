import { and, asc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db';
import { markets, type Market } from '@/db/schema';
import { choosePeers, PEERS } from '@/lib/peers';
import { ReadCache } from './read-cache';
import { nearestIn, vectorIndexes } from './vector-index';

/**
 * Where a paper's headline sits among the papers at its venue (the paper
 * page's Stats figure): the histogram of the headlines of every trading main
 * market of the same `kind`, read from the `markets.headline` cache (#12).
 * **Reads only.** A headline is a price, never a value (§1.1).
 *
 * Markets nobody has traded are left out too: they all sit at their opening price, which
 * is no one's belief and would pile into one bar. Settled markets are left out (their headline is 1 or 0, a result, not a
 * belief), as are void ones, drafts and a listing's secondary markets, whose
 * questions are not the venue's decision. The counts are cached per venue for a
 * minute: it moves with every fill but nobody needs it exact; a viewer's own
 * marker is placed from the live headline.
 *
 * `peerField` is the same histogram over the paper's peers alone
 * (`lib/peers.ts`): its related papers, then its nearest by the map's
 * vectors, among that same field.
 */

export interface VenueField {
  kind: string;
  /** Papers per equal-width bin across 0–100% (`BINS`, or `PEER_BINS` among peers), the last closed at 100. */
  bins: number[];
  /** At most `SAMPLE` headlines in percent, ascending, evenly spaced through the field's order. For hover and percentiles. */
  values: number[];
}

export const BINS = 20;
/** Peers are a few dozen papers at most: 10-point bins, so the shape still shows. */
export const PEER_BINS = 10;
const SAMPLE = 200;
/** One paper alone has nothing to be placed among. */
const MIN_FIELD = 2;
const TTL_MS = 60_000;

/** A venue's trading, traded main markets: listing (null when standalone) and headline in percent, ascending. */
type Row = { listingId: string | null; percent: number };

const venues = new ReadCache(50);
const peers = new ReadCache(500);

function venueRows(kind: string, database: Database): Promise<Row[]> {
  const compute = async () => {
    const rows = await database
      .select({ listingId: markets.listingId, headline: markets.headline })
      .from(markets)
      .where(
        and(
          eq(markets.kind, kind),
          eq(markets.isMain, true),
          inArray(markets.status, ['open', 'closed']),
          isNotNull(markets.headline),
          gt(markets.orderCount, 0),
        ),
      )
      .orderBy(asc(markets.headline));
    return rows.map((r) => ({ listingId: r.listingId, percent: (r.headline ?? 0) * 100 }));
  };
  return database === getDb() ? venues.get(kind, TTL_MS, compute) : compute();
}

/** Whether `market` is one a field applies to: a venue's main market, still trading. */
function applies(market: Market): boolean {
  return market.isMain && (market.status === 'open' || market.status === 'closed');
}

/** The histogram of `percents` (ascending), or `null` when too few. */
function fieldOf(kind: string, percents: number[], n = BINS): VenueField | null {
  if (percents.length < MIN_FIELD) return null;
  const bins = Array.from({ length: n }, () => 0);
  for (const x of percents) bins[Math.min(n - 1, Math.floor((x / 100) * n))] += 1;
  const values =
    percents.length > SAMPLE
      ? Array.from({ length: SAMPLE }, (_, i) => percents[Math.round((i * (percents.length - 1)) / (SAMPLE - 1))])
      : percents;
  return { kind, bins, values };
}

/** `null` when `market` is not one a venue field applies to, or its venue is too small. */
export async function venueField(market: Market, database: Database = getDb()): Promise<VenueField | null> {
  if (!applies(market)) return null;
  return fieldOf(
    market.kind,
    (await venueRows(market.kind, database)).map((r) => r.percent),
  );
}

/**
 * The field over the paper's peers: `null` for a market with no listing, one
 * a field does not apply to, or a paper with too few traded peers.
 */
export async function peerField(market: Market, database: Database = getDb()): Promise<VenueField | null> {
  const listingId = market.listingId;
  if (!listingId || !applies(market)) return null;
  const compute = async () => {
    const [rows, related, indexes] = await Promise.all([
      venueRows(market.kind, database),
      database.execute<{ id: string }>(sql`
        select l.id from listing_related r join listings l on l.slug = r.related_slug
         where r.listing_id = ${listingId} order by r.position
      `),
      vectorIndexes(database),
    ]);
    const percent = new Map(rows.flatMap((r) => (r.listingId ? [[r.listingId, r.percent] as const] : [])));
    const field = new Set(percent.keys());
    const keep = (id: string) => field.has(id);
    const nearest = indexes.flatMap((index) => nearestIn(index, listingId, PEERS, keep));
    const chosen = choosePeers(
      listingId,
      related.rows.map((r) => r.id),
      nearest,
      field,
    );
    return fieldOf(
      market.kind,
      chosen.map((id) => percent.get(id)!).sort((a, b) => a - b),
      PEER_BINS,
    );
  };
  return database === getDb() ? peers.get(listingId, TTL_MS, compute) : compute();
}
