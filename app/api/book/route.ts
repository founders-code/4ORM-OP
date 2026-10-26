import { NextResponse } from 'next/server';
import { bookSlots, takeBooking } from '@/lib/book';
import { getSql } from '@/lib/db';
import { fail } from '@/lib/log';
import { clientIp, takeRateLimit } from '@/lib/rate-limit';
import { roomOwner } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Public booking page: at most 5 booking attempts per IP per hour. */
const BOOKINGS_PER_HOUR = 5;

export async function GET(req: Request) {
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ minutes: 30, slots: [] });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ minutes: 30, slots: [] });
    const minutes = Number(new URL(req.url).searchParams.get('minutes') || 30);
    const desk = await bookSlots(sql, ownerId, minutes);
    return NextResponse.json(desk);
  } catch (err) {
    fail('book_failed', err);
    return NextResponse.json({ minutes: 30, slots: [], error: 'Openings could not be read.' });
  }
}

export async function POST(req: Request) {
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ error: 'Booking is not available.' }, { status: 400 });
    const ownerId = await roomOwner(sql);
    if (!ownerId) return NextResponse.json({ error: 'Booking is not available.' }, { status: 400 });
    if (!(await takeRateLimit(sql, 'book', clientIp(req), BOOKINGS_PER_HOUR, 3600))) {
      return NextResponse.json({ error: 'Too many booking attempts. Please try again in an hour.' }, { status: 429 });
    }
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const result = await takeBooking(sql, ownerId, {
      name: String(body?.name || ''),
      email: String(body?.email || ''),
      topics: String(body?.topics || ''),
      notes: String(body?.notes || ''),
      start: Number(body?.start),
      minutes: Number(body?.minutes),
      tz: String(body?.tz || ''),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    fail('book_failed', err);
    return NextResponse.json({ error: 'That slot could not be booked.' }, { status: 400 });
  }
}
