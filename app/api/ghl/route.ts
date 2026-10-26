export { GET } from '../pipeline/route';

// Route segment config is not inherited through a re-export; without this Next tries to prerender it at build.
export const dynamic = 'force-dynamic';
