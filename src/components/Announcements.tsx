import type { Announcement } from '@/db/schema';
import { Markdown } from './Markdown';
import { DismissAnnouncement } from './DismissAnnouncement';

/**
 * The admin's messages at the top of the home page (`POST /announcements`),
 * newest first, each set as a paper's running head (`RunningHead`): a quiet
 * line over a rule above the title block. Rendered on the server, so a
 * reader without JavaScript sees them too; one this browser dismissed is
 * left out by the page (`lib/announcements.ts`).
 */
export function Announcements({ items }: { items: Pick<Announcement, 'id' | 'body'>[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {items.map((a) => (
        <DismissAnnouncement key={a.id} id={a.id}>
          <Markdown className="min-w-0 flex-1">{a.body}</Markdown>
        </DismissAnnouncement>
      ))}
    </div>
  );
}
