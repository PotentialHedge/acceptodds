import { describe, expect, it } from 'vitest';
import { choosePeers, MIN_PEERS } from '@/lib/peers';

const ids = (n: number, p = 'n') => Array.from({ length: n }, (_, i) => `${p}${i}`);

describe('choosePeers', () => {
  it('takes related papers first, then the nearest, up to k', () => {
    const field = new Set([...ids(20, 'r'), ...ids(20)]);
    const peers = choosePeers('self', ids(5, 'r'), ids(20), field, 12);
    expect(peers).toEqual([...ids(5, 'r'), ...ids(7)]);
  });

  it('counts only papers in the field, never itself or one twice', () => {
    const field = new Set([...ids(MIN_PEERS), 'self']);
    const peers = choosePeers('self', ['self', 'n0', 'gone'], ['n0', ...ids(MIN_PEERS)], field);
    expect(peers).toEqual(ids(MIN_PEERS));
  });

  it('is no field below MIN_PEERS', () => {
    const field = new Set(ids(MIN_PEERS - 1));
    expect(choosePeers('self', [], ids(MIN_PEERS - 1), field)).toEqual([]);
  });
});
