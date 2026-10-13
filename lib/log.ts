/** The one log in the API. A code, plus a short database message when one was caught. No connection string. */
export function fail(code: string, err?: unknown) {
  const message = err instanceof Error ? err.message : (err == null ? '' : String(err));
  const safe = message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, 240);
  console.error(safe ? `${code} ${safe}` : code);
}
