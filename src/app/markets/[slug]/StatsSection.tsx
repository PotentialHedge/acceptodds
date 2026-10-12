'use client';

import { useState } from 'react';
import { ui } from '@/components/ui';
import { VenueStanding } from '@/components/VenueStanding';
import { PEERS } from '@/lib/peers';
import type { VenueField } from '@/server/venue-field';

/**
 * The market's Stats section: where the paper stands among its venue's papers
 * (Figure 2, with a field to place it in; "peers" redraws it among the
 * paper's peers, `peerField`, when it has enough). Prices only, never a value
 * (§1.1).
 */
export function StatsSection({
  venue,
  peers,
  headline,
}: {
  venue: VenueField;
  peers: VenueField | null;
  /** The headline now. */
  headline: number;
}) {
  const [amongPeers, setAmongPeers] = useState(false);
  const field = amongPeers && peers ? peers : venue;
  return (
    <section className="mt-10">
      <h3 className={`${ui.section} mb-3`}>Stats</h3>
      <div>
        {peers && (
          <div className="mb-4 flex justify-end font-sans text-xs text-muted">
            <span>among</span>
            {[false, true].map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={amongPeers === p}
                className={`ml-2 cursor-pointer ${amongPeers === p ? ui.on : 'hover:underline'}`}
                onClick={() => setAmongPeers(p)}
              >
                {p ? 'peers' : 'all papers'}
              </button>
            ))}
          </div>
        )}
        <VenueStanding
          field={field}
          headline={headline}
          among={field === peers ? 'this paper\u2019s peers' : undefined}
        />
        <div className={ui.caption}>
          <b>Figure 2.</b>{' '}
          {field === peers ? (
            <>
              The chance of acceptance of this paper&rsquo;s peers at {venue.kind}: up to {PEERS} trading papers, its
              related papers first, then the nearest by the paper map&rsquo;s embedding, in bins of{' '}
              {100 / field.bins.length} points;
            </>
          ) : (
            <>
              The chance of acceptance of the papers trading at {venue.kind}, in bins of {100 / field.bins.length}{' '}
              points;
            </>
          )}{' '}
          this paper&rsquo;s bin is marked and the bins the market rates less likely are shaded.
        </div>
      </div>
    </section>
  );
}
