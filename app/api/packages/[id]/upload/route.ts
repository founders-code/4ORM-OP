import { aliasTo } from '@/lib/alias';

// Retired: /api/spaces/[id]/upload stages files for both Spaces and legacy packages.
export const dynamic = 'force-dynamic';
const go = aliasTo('/api/spaces/[id]/upload');
export { go as POST };
