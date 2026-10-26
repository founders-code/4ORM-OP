import { aliasTo } from '@/lib/alias';

// Alias of /api/calendar/slots (one route per job).
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/calendar/slots');
export { go as GET, go as POST };
