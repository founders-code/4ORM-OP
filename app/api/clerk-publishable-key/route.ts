import { NextResponse } from 'next/server';
import { env } from '@/lib/env.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = env('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  const publishableKey = /^pk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(key) ? key : '';
  return NextResponse.json({ publishableKey }, { headers: { 'cache-control': 'no-store' } });
}
