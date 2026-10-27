import { getSql } from './db';
import { fail } from './log';

export function classifyApi(url: string) {
  const u = String(url || '');
  if (/leadconnectorhq|gohighlevel/i.test(u)) return 'ghl';
  if (/googleapis\.com|oauth2\.googleapis|gmail\.googleapis/i.test(u)) return 'google';
  if (/zoom\.us/i.test(u)) return 'zoom';
  if (/openai\.com/i.test(u)) return 'openai';
  if (/anthropic\.com/i.test(u)) return 'anthropic';
  if (/clerk\./i.test(u)) return 'clerk';
  if (/bankofcanada\.ca/i.test(u)) return 'boc';
  if (/4ormiq\.com/i.test(u)) return 'iq';
  if (/vercel\.com/i.test(u)) return 'vercel';
  if (/neon\.tech/i.test(u)) return 'neon';
  if (/granola\.ai/i.test(u)) return 'granola';
  if (/riverside\.fm/i.test(u)) return 'riverside';
  if (/perplexity\.ai/i.test(u)) return 'perplexity';
  return 'other';
}

function pathOf(url: string) {
  try {
    return new URL(url).pathname.slice(0, 240) || '/';
  } catch {
    return String(url || '').slice(0, 240);
  }
}

export async function recordCall(api: string, path: string, code: number, ms: number) {
  try {
    const sql = await getSql();
    if (!sql) return;
    await sql`INSERT INTO api_calls (api, path, code, ms) VALUES (${api}, ${path.slice(0, 240)}, ${code}, ${ms})`;
    if (!code || code >= 400) {
      const msg = `${api} ${path} ${code || 'no answer'} in ${ms} ms`;
      await sql`INSERT INTO ops_events (level, source, message) VALUES (${'err'}, ${api}, ${msg})`;
    }
  } catch (err) {
    fail('outbound_log', err);
  }
}

export async function tape(level: string, source: string, message: string) {
  try {
    const sql = await getSql();
    if (!sql) return;
    await sql`INSERT INTO ops_events (level, source, message) VALUES (${level}, ${source}, ${message.slice(0, 400)})`;
  } catch (err) {
    fail('ops_tape', err);
  }
}

/** One shared fetch wrapper. Every outbound HTTP call logs to api_calls (service, path, code, ms, at). */
export async function outbound(url: string, init?: RequestInit): Promise<Response> {
  const api = classifyApi(url);
  const path = pathOf(url);
  const t0 = Date.now();
  try {
    const res = await fetch(url, init);
    await recordCall(api, path, res.status, Date.now() - t0);
    return res;
  } catch (err) {
    await recordCall(api, path, 0, Date.now() - t0);
    throw err;
  }
}
