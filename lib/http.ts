/**
 * Status for a lib result that reports failure in its body ({ok:false}, {saved:false}, {sent:false},
 * {prepared:false}) or is missing. Success keeps 200. Callers keep the body so older clients still read it.
 */
export function statusFor(body: unknown, failStatus: number): ResponseInit | undefined {
  if (!body || typeof body !== 'object') return { status: failStatus };
  const b = body as Record<string, unknown>;
  if (b.ok === false || b.saved === false || b.sent === false || b.prepared === false) return { status: failStatus };
  return undefined;
}
