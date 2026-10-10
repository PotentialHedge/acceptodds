'use client';

import { useState } from 'react';
import { DISMISSED_COOKIE, withDismissed } from '@/lib/announcements';

function readCookie(name: string): string | undefined {
  const pair = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return pair && decodeURIComponent(pair.slice(name.length + 1));
}

/**
 * One announcement, with a × that hides it in this browser for good (by id,
 * so a new message shows again). Remembered in a cookie, which the home page
 * reads, so a dismissed one is never drawn at all.
 */
export function DismissAnnouncement({ id, children }: { id: string; children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  return (
    <div
      role="note"
      className="flex items-baseline gap-x-3 border-b border-rule pb-0.5 font-serif text-[15px] text-subtle"
    >
      {children}
      <button
        className="cursor-pointer text-faint hover:text-ink"
        aria-label="dismiss"
        onClick={() => {
          const value = withDismissed(readCookie(DISMISSED_COOKIE), id);
          document.cookie = `${DISMISSED_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
