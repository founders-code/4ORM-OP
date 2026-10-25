import { clerkSetup } from '@clerk/testing/playwright';
import { loadLocalEnv } from './load-local-env.mjs';

export default async function globalSetup() {
  loadLocalEnv();
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const secretKey = process.env.CLERK_SECRET_KEY || '';
  if (!publishableKey || !secretKey) {
    throw new Error('CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set in .env.local');
  }
  await clerkSetup({ publishableKey, secretKey, dotenv: false });
}
