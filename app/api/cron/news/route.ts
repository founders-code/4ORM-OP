import { aliasTo } from '@/lib/alias';

// Alias of /api/news/sweep, which vercel.json calls directly and which checks the cron bearer itself.
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/news/sweep');
export { go as GET, go as POST };
