import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db';
import { announcements, type Announcement } from '@/db/schema';

/**
 * Messages at the top of the home page, set by an admin. Their only writer.
 * Not market state: nothing here moves a balance, so it is never the engine's.
 */

export interface AnnouncementInput {
  /** Markdown, rendered as a comment is (`components/Markdown`). */
  body: string;
  /** One venue's home page, or every venue's when null. */
  kind?: string | null;
  /** Hidden from then on; never when null. */
  expiresAt?: Date | null;
  /** Shown only to a signed-in reader. */
  signedInOnly?: boolean;
}

export async function postAnnouncement(input: AnnouncementInput, database: Database = getDb()): Promise<Announcement> {
  const [row] = await database
    .insert(announcements)
    .values({
      body: input.body,
      kind: input.kind ?? null,
      expiresAt: input.expiresAt ?? null,
      signedInOnly: input.signedInOnly ?? false,
    })
    .returning();
  return row;
}

/** False when there was none with that id. */
export async function deleteAnnouncement(id: string, database: Database = getDb()): Promise<boolean> {
  const gone = await database.delete(announcements).where(eq(announcements.id, id)).returning({ id: announcements.id });
  return gone.length > 0;
}

/**
 * What is shown now, newest first: unexpired, and for `kind` or every venue.
 * With `kind` undefined (the home page listing every venue), all of them.
 * Those for signed-in readers only when `signedIn`.
 */
export async function currentAnnouncements(
  kind: string | null | undefined,
  signedIn: boolean,
  database: Database = getDb(),
): Promise<Announcement[]> {
  const live = or(isNull(announcements.expiresAt), gt(announcements.expiresAt, sql`now()`));
  const venue =
    kind === undefined
      ? undefined
      : kind === null
        ? isNull(announcements.kind)
        : or(isNull(announcements.kind), eq(announcements.kind, kind));
  return database
    .select()
    .from(announcements)
    .where(and(live, venue, signedIn ? undefined : eq(announcements.signedInOnly, false)))
    .orderBy(desc(announcements.createdAt), desc(announcements.id));
}
