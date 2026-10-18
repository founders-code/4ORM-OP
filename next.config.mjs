/** @type {import('next').NextConfig} */
const nextConfig = {
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
    '/api/news/ingest': ['./NEWS_SOURCES.md'],
    '/api/spaces': ['./data/spaces_seed.json'],
    '/api/spaces/[id]': ['./data/spaces_seed.json'],
  },
  // Serve the public landing at "/" so the look is preserved exactly.
  // The gated rooms live at /advisor.html, /employee.html, /engineering.html.
  // /control-room rewrites to the Control Room prototype.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/control-room', destination: '/control-room.html' },
      { source: '/terms-of-service', destination: '/terms-of-service.html' },
      { source: '/privacy-policy', destination: '/privacy-policy.html' },
      { source: '/book', destination: '/book.html' },
      { source: '/chad', destination: '/book.html' },
    ];
  },
};
export default nextConfig;
