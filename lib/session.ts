import { auth, currentUser } from '@clerk/nextjs/server';
import { getSql, ownerForEmail, rememberOwner } from './db';
import { ROOM_EMAIL } from './room';

export { ROOM_EMAIL };

export async function openBoard() {
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

/** Signed-in page owner. Test users stay on their own id and never read Chad's room. */
export async function sessionOwner(session: { userId: string; sql: Awaited<ReturnType<typeof getSql>> }) {
  try {
    const user = await currentUser();
    if (user?.publicMetadata?.test === true) return session.userId;
  } catch {
    /* fall through to the room owner */
  }
  if (!session.sql) return session.userId;
  return (await roomOwner(session.sql)) || session.userId;
}
