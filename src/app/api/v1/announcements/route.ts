import * as h from '@/server/api/handlers';
import { methodNotAllowed } from '@/server/api/http';

export const dynamic = 'force-dynamic';

export const GET = h.getAnnouncements;
export const POST = h.postAnnouncements;
export const { PUT, PATCH, DELETE } = methodNotAllowed('GET', 'POST');
