import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { externalLinks } from '@/lib/external-links';

/**
 * The specification of `lib/external-links.ts`: three searches built from
 * the title, none when there is no title, and none repeated where the
 * listing already links to the same site. Property tests run the URL
 * round-trip, because a search link that loses the title in encoding
 * searches for the wrong paper.
 */
const NUM_RUNS = 500;

const LOOKUP_HOSTS = ['scholar.google.com', 'www.semanticscholar.org', 'arxiv.org'];

describe('externalLinks', () => {
  it('searches the title on the three sites, in order', () => {
    const links = externalLinks({ title: 'Attention Is All You Need' });
    expect(links.map((l) => l.label)).toEqual(['Google Scholar', 'Semantic Scholar', 'arXiv']);
    expect(links.map((l) => new URL(l.url).host)).toEqual(LOOKUP_HOSTS);
    expect(new URL(links[0].url).searchParams.get('q')).toBe('Attention Is All You Need');
    expect(new URL(links[1].url).searchParams.get('q')).toBe('Attention Is All You Need');
    expect(new URL(links[2].url).searchParams.get('query')).toBe('Attention Is All You Need');
  });

  it('encodes a title that needs it', () => {
    const [scholar] = externalLinks({ title: 'Mamba: Linear-Time Sequence Modeling with $tates & <tags>' });
    const url = new URL(scholar.url);
    expect(url.searchParams.get('q')).toBe('Mamba: Linear-Time Sequence Modeling with $tates & <tags>');
    expect(scholar.url).not.toContain(' ');
  });

  it('gives no links for a title that is empty or whitespace', () => {
    expect(externalLinks({ title: '' })).toEqual([]);
    expect(externalLinks({ title: '   \n\t ' })).toEqual([]);
  });

  it('suppresses a site the listing already links to', () => {
    const supplied = [
      { label: 'arXiv', url: 'https://arxiv.org/abs/1706.03762' },
      { label: 'OpenReview', url: 'https://openreview.net/forum?id=abc' },
    ];
    const links = externalLinks({ title: 'Some Paper', links: supplied });
    expect(links.map((l) => l.label)).toEqual(['Google Scholar', 'Semantic Scholar']);
  });

  it('keeps every lookup when the supplied links are elsewhere', () => {
    const links = externalLinks({ title: 'Some Paper', links: [{ url: 'https://openreview.net/forum?id=abc' }] });
    expect(links.map((l) => l.label)).toEqual(['Google Scholar', 'Semantic Scholar', 'arXiv']);
  });

  it('ignores a supplied link that is not a URL', () => {
    const links = externalLinks({ title: 'Some Paper', links: [{ url: 'not a url' }] });
    expect(links).toHaveLength(3);
  });
});

describe('externalLinks properties', () => {
  it('round-trips any title through its search URL', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        for (const link of externalLinks({ title })) {
          const url = new URL(link.url);
          const host = new Map([
            ['Google Scholar', url.searchParams.get('q')],
            ['Semantic Scholar', url.searchParams.get('q')],
            ['arXiv', url.searchParams.get('query')],
          ]);
          expect(host.get(link.label)).toBe(title.trim());
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('never repeats a host, and never mutates the input', () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.webUrl(), { maxLength: 5 }), (title, urls) => {
        const links = urls.map((url) => ({ url }));
        const before = JSON.stringify(links);
        const out = externalLinks({ title, links });
        expect(new Set(out.map((l) => new URL(l.url).host)).size).toBe(out.length);
        expect(JSON.stringify(links)).toBe(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('a lookup appears only when no supplied link shares its host', () => {
    fc.assert(
      fc.property(fc.string(), fc.webUrl(), (title, url) => {
        const host = new URL(url).host;
        const out = externalLinks({ title, links: [{ url }] });
        for (const link of out) {
          expect(new URL(link.url).host).not.toBe(host);
        }
        for (const wanted of LOOKUP_HOSTS) {
          if (host === wanted) expect(out.map((l) => new URL(l.url).host)).not.toContain(wanted);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
