import { aliasTo } from '@/lib/alias';

// Alias of /api/pipeline (one route per job).
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/pipeline');
export { go as GET };
