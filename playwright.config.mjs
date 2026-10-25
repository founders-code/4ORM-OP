export default {
  testDir: './tests',
  globalSetup: './scripts/clerk-global-setup.mjs',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://www.4ormop.com',
    viewport: { width: 1440, height: 900 },
  },
};
