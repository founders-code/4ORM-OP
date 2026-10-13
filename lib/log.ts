function redact(value: string) {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

/** The one log in the API. A code, the exception message, and the stack. No connection string. */
export function fail(code: string, err?: unknown) {
  const message = err instanceof Error ? err.message : (err == null ? '' : String(err));
  const safe = redact(message).replace(/\s+/g, ' ').trim().slice(0, 500);
  console.error(safe ? `${code} ${safe}` : code);
  if (err instanceof Error && err.stack) console.error(redact(err.stack).slice(0, 2000));
}
