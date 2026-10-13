/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are checked field by field */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, trader } from './api-client';
import { closePool, resetDatabase } from './helpers';

beforeEach(async () => {
  await resetDatabase();
  process.env.API_RATE_LIMIT_BURST = '1000';
  process.env.API_RATE_LIMIT_PER_SECOND = '1000';
});

afterAll(closePool);

describe('announcements', () => {
  it('only an admin may post or delete one', async () => {
    const t = await trader('plain', ['read', 'trade']);
    expect((await api('POST', '/announcements', { token: t.token, body: { body: 'hi' } })).status).toBe(403);
    expect((await api('POST', '/announcements', { body: { body: 'hi' } })).status).toBe(401);
  });

  it('shows a venue its own and every venue’s, newest first, until expiry or deletion', async () => {
    const admin = await trader('ops', ['admin']);
    const post = async (body: any) => {
      const res = await api('POST', '/announcements', { token: admin.token, body });
      expect(res.status).toBe(201);
      return res.body as any;
    };
    const everywhere = await post({ body: 'Maintenance *tonight*.' });
    const iclr = await post({ body: 'ICLR only', kind: 'ICLR 2027' });
    await post({ body: 'Other venue', kind: 'OpenAI Math' });
    await post({ body: 'Gone', expiresAt: new Date(Date.now() - 1000).toISOString() });

    const forIclr = await api('GET', '/announcements?kind=ICLR%202027');
    expect(forIclr.status).toBe(200);
    expect(forIclr.body.announcements.map((a: any) => a.body)).toEqual(['ICLR only', 'Maintenance *tonight*.']);
    expect((await api('GET', '/announcements')).body.announcements).toHaveLength(3);

    expect((await api('DELETE', `/announcements/${iclr.id}`, { token: admin.token })).status).toBe(204);
    expect((await api('DELETE', `/announcements/${iclr.id}`, { token: admin.token })).status).toBe(404);
    const after = await api('GET', '/announcements?kind=ICLR%202027');
    expect(after.body.announcements.map((a: any) => a.id)).toEqual([everywhere.id]);
  });

  it('shows a signed-in-only message to a caller with a credential, and to nobody else', async () => {
    const admin = await trader('ops3', ['admin']);
    const reader = await trader('reader', ['read']);
    await api('POST', '/announcements', { token: admin.token, body: { body: 'Everyone' } });
    const res = await api('POST', '/announcements', {
      token: admin.token,
      body: { body: 'Members', signedInOnly: true },
    });
    expect(res.body.signedInOnly).toBe(true);

    expect((await api('GET', '/announcements')).body.announcements.map((a: any) => a.body)).toEqual(['Everyone']);
    const signedIn = await api('GET', '/announcements', { token: reader.token });
    expect(signedIn.body.announcements.map((a: any) => a.body)).toEqual(['Members', 'Everyone']);
  });

  it('refuses an empty message', async () => {
    const admin = await trader('ops2', ['admin']);
    expect((await api('POST', '/announcements', { token: admin.token, body: { body: '  ' } })).status).toBe(400);
  });
});
