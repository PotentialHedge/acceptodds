/**
 * Which announcements this browser has dismissed, in a cookie, so the server
 * leaves them out of the page rather than the browser hiding them after it
 * draws. Space-separated ids, only the most recent few: an old one has
 * usually been deleted or has expired.
 */
export const DISMISSED_COOKIE = 'announcements_dismissed';

const KEEP = 20;

export function parseDismissed(value: string | undefined): string[] {
  return (value ?? '').split(' ').filter(Boolean);
}

/** The cookie's value with `id` added, newest last. */
export function withDismissed(value: string | undefined, id: string): string {
  return [...parseDismissed(value).filter((d) => d !== id), id].slice(-KEEP).join(' ');
}
