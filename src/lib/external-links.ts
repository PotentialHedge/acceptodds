/**
 * Where else to look a paper up (#34): its title searched for on Google
 * Scholar, Semantic Scholar and arXiv, shown beside the links the listing
 * already carries. Built, never fetched — the venue still knows nothing
 * about papers, and a reader gets these links without any client making a
 * network call. Client-safe.
 *
 * A lookup is a fallback for "I could not find it from here", not a second
 * door to the same room: a link the listing already carries to one of these
 * sites suppresses that site's search.
 */

export interface LookupLink {
  label: string;
  url: string;
}

/** The searches, in the order they are shown. */
const LOOKUPS: readonly { label: string; host: string; search: (title: string) => string }[] = [
  {
    label: 'Google Scholar',
    host: 'scholar.google.com',
    search: (title) => `https://scholar.google.com/scholar?${new URLSearchParams({ q: title })}`,
  },
  {
    label: 'Semantic Scholar',
    host: 'www.semanticscholar.org',
    search: (title) => `https://www.semanticscholar.org/search?${new URLSearchParams({ q: title })}`,
  },
  {
    label: 'arXiv',
    host: 'arxiv.org',
    search: (title) => `https://arxiv.org/search/?${new URLSearchParams({ query: title, searchtype: 'all' })}`,
  },
];

/**
 * The lookups for a listing, in `LOOKUPS` order. A title that is empty or
 * all whitespace gets none: there is nothing to search for, and a link to a
 * search for nothing is noise on the page.
 */
export function externalLinks(paper: { title: string; links?: readonly { url: string }[] }): LookupLink[] {
  const title = paper.title.trim();
  if (!title) return [];
  const supplied = new Set<string>();
  for (const link of paper.links ?? []) {
    const host = hostOf(link.url);
    if (host !== null) supplied.add(host);
  }
  return LOOKUPS.filter((lookup) => !supplied.has(lookup.host)).map((lookup) => ({
    label: lookup.label,
    url: lookup.search(title),
  }));
}

/** A URL's host, or null when it does not parse. Links are validated http(s) at the API; this is a pure function. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
