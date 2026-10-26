import { aliasTo } from '@/lib/alias';

// Alias of /api/calendar (one route per job).
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/calendar');
export { go as GET, go as POST };
