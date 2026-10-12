/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/ceo': ['./ceo/**/*'],
    '/api/ceo/refresh': ['./ceo/**/*'],
    '/api/ceo/chat': ['./ceo/**/*'],
    '/api/ceo/weights': ['./ceo/**/*'],
    '/api/ceo/moves/[id]/do': ['./ceo/**/*'],
    '/api/ceo/moves/[id]/snooze': ['./ceo/**/*'],
    '/api/cron/brief': ['./ceo/**/*'],
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
    ];
  },
};
export default nextConfig;
