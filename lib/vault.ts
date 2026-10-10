import { clerkClient } from '@clerk/nextjs/server';
import { openSeal, seal } from './seal.mjs';
import { ROOM_EMAIL } from './room';

type Bag = {
  googleRefresh?: string;
  ghlKey?: string;
  ghlLocation?: string;
  databaseUrl?: string;
};

function material() {
  return process.env.ENCRYPTION_KEY || process.env.CLERK_SECRET_KEY || '';
}

function parseBag(packed: unknown): Bag {
  if (typeof packed !== 'string' || !packed) return {};
  const plain = openSeal(packed, material());
  if (!plain) return {};
  try {
    const parsed = JSON.parse(plain) as Bag;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function readBag(userId: string): Promise<Bag> {
  if (!userId || !material()) return {};
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return parseBag((user.privateMetadata as { seal?: unknown } | null)?.seal);
}

async function writeBag(userId: string, bag: Bag) {
  const packed = seal(JSON.stringify(bag), material());
  if (!packed) return false;
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { privateMetadata: { seal: packed } });
  return true;
}

export async function loadCredsFor(userId: string) {
  const bag = await readBag(userId);
  return {
    googleRefresh: bag.googleRefresh || process.env.GOOGLE_REFRESH_TOKEN || '',
    ghlKey: bag.ghlKey || process.env.GHL_API_KEY || process.env.GOHIGHLEVEL_API_KEY || '',
    ghlLocation: bag.ghlLocation || process.env.GHL_LOCATION_ID || process.env.GOHIGHLEVEL_LOCATION_ID || '',
  };
}

export async function saveGoogleRefresh(userId: string, refresh: string) {
  const bag = await readBag(userId);
  bag.googleRefresh = refresh;
  return writeBag(userId, bag);
}

export async function saveGhl(userId: string, key: string, location: string) {
  const bag = await readBag(userId);
  bag.ghlKey = key;
  bag.ghlLocation = location;
  return writeBag(userId, bag);
}

export async function saveDatabaseUrl(userId: string, url: string) {
  const bag = await readBag(userId);
  bag.databaseUrl = url;
  return writeBag(userId, bag);
}

let cachedDatabaseUrl = '';

export function rememberDatabaseUrl(url: string) {
  cachedDatabaseUrl = url;
}

export async function savedDatabaseUrl() {
  if (cachedDatabaseUrl) return cachedDatabaseUrl;
  if (!material()) return '';
  try {
    const client = await clerkClient();
    const list = await client.users.getUserList({ emailAddress: [ROOM_EMAIL], limit: 1 });
    const user = list.data[0];
    if (!user) return '';
    const url = parseBag((user.privateMetadata as { seal?: unknown } | null)?.seal).databaseUrl || '';
    if (url) cachedDatabaseUrl = url;
    return url;
  } catch {
    return '';
  }
}
