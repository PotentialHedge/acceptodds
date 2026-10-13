/**
 * The one link a paper's row in a list shows, in its narrow left column: the
 * listing's PDF, else its first link as `[abs]` (arXiv's word for a paper's
 * page), so a listing with no PDF yet still links somewhere and never calls
 * a web page a PDF. `undefined` when the listing has no links. Client-safe.
 */
export function rowLink(links: readonly { url: string; label: string }[]): { url: string; label: string } | undefined {
  const pdf = links.find((l) => l.label.toLowerCase() === 'pdf');
  if (pdf) return pdf;
  const first = links.at(0);
  return first && { url: first.url, label: 'abs' };
}
