import { describe, expect, it } from 'vitest';
import { rowLink } from '@/lib/paper-link';

describe('rowLink', () => {
  it('is the PDF, whatever its case or position', () => {
    const links = [
      { label: 'OpenReview', url: 'https://openreview.net/forum?id=x' },
      { label: 'pdf', url: 'https://example.org/x.pdf' },
    ];
    expect(rowLink(links)).toEqual(links[1]);
  });

  it('falls back to the first link as [abs], never calling it a PDF', () => {
    const links = [
      { label: 'NeurIPS', url: 'https://neurips.cc/virtual/2026/poster/1' },
      { label: 'arXiv', url: 'https://arxiv.org/abs/2601.00001' },
    ];
    expect(rowLink(links)).toEqual({ label: 'abs', url: links[0]!.url });
  });

  it('is nothing for a listing with no links', () => {
    expect(rowLink([])).toBeUndefined();
  });
});
