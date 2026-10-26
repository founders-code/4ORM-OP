import { aliasTo } from '@/lib/alias';

// Retired: Spaces replaced packages. /api/spaces/[id] falls back to the legacy package row when needed.
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/spaces/[id]');
export { go as GET, go as PATCH, go as POST, go as DELETE };
