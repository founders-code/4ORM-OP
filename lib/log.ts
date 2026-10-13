function redact(value: string) {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

function textOf(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const row = err as Record<string, unknown>;
    const parts = [row.severity, row.code, row.message, row.detail, row.hint]
      .map((part) => (part == null ? '' : String(part)))
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return err == null ? '' : String(err);
}

/** The one log in the API. A code, the exception message, and the stack. No connection string. */
export function fail(code: string, err?: unknown) {
  const message = textOf(err);
  const safe = redact(message).replace(/\s+/g, ' ').trim().slice(0, 500);
  console.error(safe ? `${code} ${safe}` : code);
  const stack = err instanceof Error ? err.stack : (err && typeof err === 'object' ? String((err as { stack?: unknown }).stack || '') : '');
  if (stack) console.error(redact(stack).slice(0, 2000));
}
