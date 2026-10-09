/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve the public landing at "/" so the look is preserved exactly.
  // The gated rooms live at /advisor.html, /employee.html, /engineering.html.
  // /control-room rewrites to the Control Room prototype.
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/control-room', destination: '/control-room.html' },
    ];
  },
};
export default nextConfig;
