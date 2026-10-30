import { auth, currentUser } from '@clerk/nextjs/server';
import { getSql, ownerForEmail, rememberOwner } from './db';
import { ROOM_EMAIL } from './room';
import { teamHomeFromUser } from './gate.mjs';

export { ROOM_EMAIL };

export type BoardSession = { userId: string; sql: Awaited<ReturnType<typeof getSql>> };

export async function openBoard(): Promise<BoardSession | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const sql = await getSql();
  if (!sql) return { userId, sql: null };
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    if (email) await rememberOwner(sql, email, userId);
  } catch {
    /* the board still reads rows for this session */
  }
  return { userId, sql };
}

export async function roomOwner(sql: NonNullable<Awaited<ReturnType<typeof getSql>>>) {
  const fixed = process.env.CONTROL_ROOM_OWNER_ID;
  if (fixed) return fixed;
  return ownerForEmail(sql, ROOM_EMAIL);
}

/** True only for Chad's sign-in email (case-insensitive). */
export function isRoomEmail(email: string | null | undefined) {
  return String(email || '').trim().toLowerCase() === ROOM_EMAIL;
}

/** Primary email of the signed-in Clerk user, or '' when the lookup fails or does not match the session. */
export async function sessionEmail(session: BoardSession) {
  try {
    const user = await currentUser();
    if (!user || user.id !== session.userId) return '';
    return String(user.primaryEmailAddress?.emailAddress || '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Whose room this signed-in session may read. Explicit allowlist, fails closed:
 * - ROOM_EMAIL (Chad) reads the room owner's rows;
 * - Clerk users with publicMetadata.test === true (strict boolean) read their own isolated rows;
 * - everyone else, and any Clerk lookup failure, gets null. Callers answer 403.
 */
export async function sessionOwner(session: BoardSession): Promise<string | null> {
  let user: Awaited<ReturnType<typeof currentUser>>;
  try {
    user = await currentUser();
  } catch {
    return null;
  }
  if (!user || user.id !== session.userId) return null;
  if (user.publicMetadata?.test === true) return session.userId;
  if (!isRoomEmail(user.primaryEmailAddress?.emailAddress)) return null;
  if (!session.sql) return session.userId;
  const owner = await roomOwner(session.sql).catch(() => null);
  return owner || session.userId;
}

/**
 * Bruce's workspace and the News it shows (30 Oct 2026). Chad and Clerk test users get their usual owner.
 * A team member with a workspace (lib/gate.mjs TEAM_HOMES) gets the room owner's id, because that workspace's
 * rows are kept under the room owner with their own workspace key (bw_* tables only). Everyone else gets null.
 */
export async function teamWorkspaceOwner(session: BoardSession): Promise<string | null> {
  const own = await sessionOwner(session);
  if (own) return own;
  let user: Awaited<ReturnType<typeof currentUser>>;
  try {
    user = await currentUser();
  } catch {
    return null;
  }
  if (!user || user.id !== session.userId || !session.sql) return null;
  if (!teamHomeFromUser(user)) return null;
  return (await roomOwner(session.sql).catch(() => null)) || null;
}
