import { venue, venues, venueSlug, type Venue } from '@/venues';
import { PRICE_FLOOR } from './jev';

/**
 * What a listing's market looks like when it is opened on demand
 * (`server/market-start.ts`), by the listing's `kind`: its venue's market
 * (`venues/`), in the shape the engine and JEV take. A kind with no venue
 * cannot be traded until a client creates its markets itself
 * (`POST /markets`).
 */
export interface MarketTemplate {
  question: string;
  /** The line under the question, stored as the market's `description`. */
  subtitle: string | null;
  contract: string;
  /** Best first: the headline is `1 − P(last)` (`lib/headline.ts`). */
  outcomes: string[];
  closesAt: Date;
  /** The expected field that sizes `b` (§1.3). */
  expectedTraders: number;
  /** Where the market opens when JEV is not asked or gives no answer: one price per outcome, summing to 1. */
  fallbackPrices: number[];
  /**
   * What JEV is asked: one criterion per outcome, in outcome order; `null`: no model call. Its answer is
   * ranked among `reference` and opens the market `spread` wide with JEV_TARGET_MEAN as its target mean.
   */
  jev: Venue['market']['jev'];
  /** Opened when the listing is posted (`POST /listings`), not on demand. */
  opensWithListing: boolean;
}

function templateOf(v: Venue): MarketTemplate {
  const m = v.market;
  return {
    question: m.question,
    subtitle: m.subtitle ?? null,
    contract: m.contract,
    outcomes: m.outcomes.map((o) => o.label),
    closesAt: m.closesAt,
    expectedTraders: m.expectedTraders,
    fallbackPrices: openingPrices(v),
    jev: m.jev,
    opensWithListing: m.opensWithListing,
  };
}

/** The env var that overrides a venue's prior: `OPENING_PRIOR_ICLR2027`, from its short path (`venueSlug`). */
export function openingPriorVar(v: Venue): string {
  return `OPENING_PRIOR_${venueSlug(v).toUpperCase()}`;
}

/**
 * The prices a venue's markets open at when JEV is not asked or gives no answer: its outcomes' `openingPrice`,
 * unless {@link openingPriorVar} sets the headline (`1 − P(last)`: for ICLR, Accept) of a two-outcome venue,
 * e.g. `OPENING_PRIOR_ICLR2027=0.30` opens at 30/70. Between `PRICE_FLOOR` and `1 − PRICE_FLOOR`, so the
 * house's subsidy stays bounded (§1.7); anything else throws rather than open at a price nobody chose.
 */
export function openingPrices(v: Venue): number[] {
  const name = openingPriorVar(v);
  const value = process.env[name]?.trim();
  if (!value) return v.market.outcomes.map((o) => o.openingPrice);
  const p = Number(value);
  if (v.market.outcomes.length !== 2) throw new Error(`${name} is set, but ${v.kind} has more than two outcomes`);
  if (!Number.isFinite(p) || p < PRICE_FLOOR || p > 1 - PRICE_FLOOR) {
    throw new Error(`${name} must be a decimal probability between ${PRICE_FLOOR} and ${1 - PRICE_FLOOR}`);
  }
  return [p, 1 - p];
}

export function marketTemplate(kind: string | null): MarketTemplate | null {
  const v = venue(kind);
  return v && templateOf(v);
}

/** The kind's template while a first trade may still make a market from it: before it closes. */
export function openMarketTemplate(kind: string | null): MarketTemplate | null {
  const t = marketTemplate(kind);
  return t && t.closesAt.getTime() > Date.now() ? t : null;
}

/** Every template, for sizing the house treasury (`db/seed.ts`). */
export function marketTemplates(): MarketTemplate[] {
  return venues().map(templateOf);
}
