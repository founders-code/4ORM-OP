/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve the public landing at "/" so the look is preserved exactly.
  // The gated rooms live at /advisor.html, /employee.html, /engineering.html.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};
export default nextConfig;
