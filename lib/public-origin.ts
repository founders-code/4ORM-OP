const HOSTS = new Set(['www.4ormop.com', '4ormop.com', '4orm-op.vercel.app', 'localhost:3000']);

export function requestOrigin(req: Request) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim().toLowerCase();
  if (!HOSTS.has(host)) return null;
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}
