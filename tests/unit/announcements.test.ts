import { describe, expect, it } from 'vitest';
import { parseDismissed, withDismissed } from '@/lib/announcements';

describe('dismissed announcements', () => {
  it('reads an absent or empty cookie as none', () => {
    expect(parseDismissed(undefined)).toEqual([]);
    expect(parseDismissed('')).toEqual([]);
  });

  it('adds an id once, newest last, and keeps only the last 20', () => {
    expect(parseDismissed(withDismissed('a b', 'a'))).toEqual(['b', 'a']);
    let v: string | undefined;
    for (let i = 0; i < 25; i += 1) v = withDismissed(v, `id${i}`);
    expect(parseDismissed(v)).toHaveLength(20);
    expect(parseDismissed(v).at(-1)).toBe('id24');
    expect(parseDismissed(v)[0]).toBe('id5');
  });
});
