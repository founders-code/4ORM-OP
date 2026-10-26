/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 reads this under `experimental` only; at the top level it was ignored (build warned
  // "Unrecognized key(s): outputFileTracingIncludes") and these files were not traced into the functions.
  experimental: {
  outputFileTracingIncludes: {
    '/api/ceo': ['./ceo/**/*'],
    '/api/ceo/refresh': ['./ceo/**/*'],
    '/api/ceo/chat': ['./ceo/**/*'],
    '/api/ceo/plan': ['./ceo/**/*'],
    '/api/ceo/weights': ['./ceo/**/*'],
    '/api/ceo/moves/[id]/do': ['./ceo/**/*'],
    '/api/ceo/moves/[id]/snooze': ['./ceo/**/*'],
    '/api/cron/brief': ['./ceo/**/*'],
    '/api/cron/ceo': ['./ceo/**/*'],
    '/api/ceo/daily': ['./ceo/**/*'],
    '/api/ceo/context': ['./ceo/**/*'],
    '/api/finance': ['./ceo/**/*'],
    '/api/snapshots': ['./ceo/**/*'],
    '/api/cron/snapshot': ['./ceo/**/*'],
    '/api/cron/news': ['./NEWS_SOURCES.md'],
    '/api/news': ['./NEWS_SOURCES.md'],
    '/api/news/refresh': ['./NEWS_SOURCES.md'],
    '/api/news/sweep': ['./NEWS_SOURCES.md'],
    '/api/news/ingest': ['./NEWS_SOURCES.md'],
    '/api/spaces': ['./data/spaces_seed.json'],
    '/api/spaces/[id]': ['./data/spaces_seed.json'],
    '/design/[...path]': ['./design-reference/**/*'],
    '/api/private-doc': ['./private-docs/**/*'],
  },
  },
  // Serve the public landing at "/" so the look is preserved exactly.
  // The gated rooms live at /advisor.html, /employee.html, /engineering.html.
  // /control-room rewrites to the Control Room prototype.
  async redirects() {
    return [
      { source: '/control-room', destination: '/war-room', permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/control-room', destination: '/control-room.html' },
      { source: '/playbook', destination: '/control-room.html' },
      { source: '/calendar', destination: '/control-room.html' },
      { source: '/news', destination: '/control-room.html' },
      { source: '/email-board', destination: '/control-room.html' },
      { source: '/email', destination: '/control-room.html' },
      { source: '/pipeline', destination: '/control-room.html' },
      { source: '/spaces', destination: '/control-room.html' },
      { source: '/documents', destination: '/control-room.html' },
      { source: '/links', destination: '/control-room.html' },
      { source: '/war-room', destination: '/control-room.html' },
      { source: '/space-detail', destination: '/control-room.html' },
      { source: '/zoom', destination: '/control-room.html' },
      { source: '/completed', destination: '/control-room.html' },
      { source: '/notes', destination: '/control-room.html' },
      { source: '/drive', destination: '/control-room.html' },
      { source: '/contacts', destination: '/control-room.html' },
      { source: '/financials', destination: '/control-room.html' },
      { source: '/integrations', destination: '/control-room.html' },
      { source: '/terms-of-service', destination: '/terms-of-service.html' },
      { source: '/privacy-policy', destination: '/privacy-policy.html' },
      { source: '/book', destination: '/book.html' },
      { source: '/chad', destination: '/book.html' },
    ];
  },
};
export default nextConfig;
