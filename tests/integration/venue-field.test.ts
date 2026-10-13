import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { markets, type Market } from '@/db/schema';
import { MIN_PEERS } from '@/lib/peers';
import { createMarket, trade } from '@/server/engine';
import { setRelated, upsertListing } from '@/server/listings';
import { setMap } from '@/server/map';
import { invalidateMap } from '@/server/map-cache';
import { PEER_BINS, peerField, venueField } from '@/server/venue-field';
import { closePool, resetDatabase, seedMarket, STARTING_MICRO, type Fixture } from './helpers';

/** The paper page's Stats figure: a paper among its venue's papers, or among its peers (`server/venue-field.ts`). */

let fx: Fixture;

beforeEach(async () => {
  await resetDatabase();
  fx = await seedMarket(1);
}, 60_000);

afterAll(async () => {
  await closePool();
});

/**
 * `n` listings at `kind`, `p0`…, each with a main market; the first `traded`
 * of them traded. The field caches per venue, so every test has its own.
 */
async function papers(kind: string, n: number, traded: number): Promise<Market[]> {
  const out: Market[] = [];
  for (let i = 0; i < n; i += 1) {
    const { listing } = await upsertListing({ slug: `${kind}-p${i}`, title: `p${i}`, kind });
    const created = await createMarket({
      slug: `${kind}-p${i}-decision`,
      question: `p${i}?`,
      outcomes: ['Accept', 'Reject'],
      kind,
      startingBalanceMicro: STARTING_MICRO,
      expectedTraders: 3,
      closesAt: new Date(Date.now() + 86_400_000),
      listingId: listing.id,
      listingRank: 0,
      status: 'open',
    });
    if (i < traded)
      await trade(fx.traderIds[0], created.marketId, created.outcomeIds[0], BigInt(i + 1) * 1_000_000n, 10n ** 12n);
    out.push((await getDb().select().from(markets).where(eq(markets.id, created.marketId)))[0]);
  }
  return out;
}

describe('peerField', () => {
  it('places a paper among its traded related and nearest papers, never itself', async () => {
    const kind = 'Peers';
    // p0 is the paper; p1–p13 are traded; p14 is not.
    const all = await papers(kind, 15, 14);
    await setMap({
      kind,
      points: all.map((_, i) => ({ slug: `${kind}-p${i}`, x: i, y: 0, vector: [1, i * 0.1] })),
      regions: [],
      clusters: [],
    });
    const listing = (await upsertListing({ slug: `${kind}-p0`, title: 'p0', kind })).listing;
    await setRelated(listing, [
      { slug: `${kind}-p14`, score: 2 },
      { slug: `${kind}-p13`, score: 1 },
    ]);
    invalidateMap();

    const peers = await peerField(all[0]);
    expect(peers?.values).toHaveLength(13);
    expect(peers?.bins).toHaveLength(PEER_BINS);
    expect(peers?.bins.reduce((s, b) => s + b, 0)).toBe(13);
    expect((await venueField(all[0]))?.values).toHaveLength(14);
  });

  it('is no field with too few traded peers, or for a market with no listing', async () => {
    const kind = 'Few';
    const all = await papers(kind, MIN_PEERS + 1, MIN_PEERS);
    await setMap({
      kind,
      points: all.map((_, i) => ({ slug: `${kind}-p${i}`, x: i, y: 0, vector: [1, i * 0.1] })),
      regions: [],
      clusters: [],
    });
    invalidateMap();
    // p0 is traded, so it has MIN_PEERS - 1 traded peers.
    expect(await peerField(all[0])).toBeNull();
    // The last is untraded, and every other is its peer.
    expect((await peerField(all[MIN_PEERS]))?.values).toHaveLength(MIN_PEERS);

    const standalone = (await getDb().select().from(markets).where(eq(markets.id, fx.marketId)))[0];
    expect(await peerField(standalone)).toBeNull();
  });
});
