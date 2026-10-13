import { marketHeadline, type MarketLike } from '@/lib/headline';

type Live = MarketLike & { orderCount: number };

/**
 * Whether `MarketLive` sets its Stats section: only once traded and while
 * trading, since holdings are zeroed at settlement, and never for a void
 * market, which has no headline.
 */
export function showsStats(market: Live): boolean {
  return market.orderCount > 0 && market.status !== 'settled' && marketHeadline(market) !== null;
}

/**
 * How many figures `MarketLive` sets: the price chart once the market has a
 * fill, then the venue standing (Figure 2, in Stats) when there is a field to
 * place it in. A page numbers its own figures after them. Not a client
 * module, so the server can call it too.
 */
export function marketLiveFigures(market: Live, hasVenue: boolean): number {
  return (market.orderCount > 0 ? 1 : 0) + (hasVenue && showsStats(market) ? 1 : 0);
}
