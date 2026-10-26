import { aliasTo } from '@/lib/alias';

// Retired: Spaces replaced packages. Data stays in the packages table; /api/spaces reads through to it.
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/spaces');
export { go as GET, go as POST };
