import { createHmac } from 'crypto';
import { tokenOk } from './guard.mjs';

function headerGet(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '');
  return String(headers[name] || headers[name.toLowerCase()] || '');
}

/** Shared secret on the query string or a hook header. Missing expected never passes. */
export function hookTokenOk(req, expected) {
  if (!expected) return false;
  const url = typeof req?.url === 'string' ? req.url : '';
  let query = '';
  try {
    query = url ? new URL(url).searchParams.get('token') || '' : '';
  } catch {
    query = '';
  }
  const headers = req?.headers;
  const presented =
    query ||
    headerGet(headers, 'x-hook-token') ||
    headerGet(headers, 'x-ghl-token') ||
    headerGet(headers, 'x-webhook-secret') ||
    '';
  const auth = headerGet(headers, 'authorization');
  const bearer = auth.slice(0, 7).toLowerCase() === 'bearer ' ? auth.slice(7).trim() : '';
  return tokenOk(presented, expected) || tokenOk(bearer, expected);
}

export function calendarTokenOk(headers, expected) {
  if (!expected) return false;
  const presented = headerGet(headers, 'x-goog-channel-token');
  return tokenOk(presented, expected);
}

export function zoomSignature(raw, timestamp, secret) {
  return `v0=${createHmac('sha256', String(secret)).update(`v0:${timestamp}:${raw}`).digest('hex')}`;
}

export function zoomOk(raw, timestamp, presented, secret) {
  if (!secret || !presented || !timestamp) return false;
  return tokenOk(presented, zoomSignature(raw, timestamp, secret));
}

export function zoomCrc(plainToken, secret) {
  return createHmac('sha256', String(secret)).update(String(plainToken)).digest('hex');
}

export function ghlHmacOk(raw, presented, secret) {
  if (!secret || !presented) return false;
  const hex = createHmac('sha256', String(secret)).update(raw).digest('hex');
  const b64 = createHmac('sha256', String(secret)).update(raw).digest('base64');
  return tokenOk(presented, hex) || tokenOk(presented, b64) || tokenOk(presented, `sha256=${hex}`);
}

export function ghlOk(req, raw, expected) {
  if (!expected) return false;
  if (hookTokenOk(req, expected)) return true;
  const presented =
    headerGet(req?.headers, 'x-wh-signature') ||
    headerGet(req?.headers, 'x-ghl-signature') ||
    headerGet(req?.headers, 'x-signature');
  return ghlHmacOk(raw, presented, expected);
}
