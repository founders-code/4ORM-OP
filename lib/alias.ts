import { NextResponse } from 'next/server';

/**
 * One route per job: a retired alias answers 308 (method and body kept) to its canonical route.
 * `target` may hold [param] placeholders filled from the dynamic route params.
 */
export function aliasTo(target: string) {
  return (req: Request, ctx?: { params?: Record<string, string> }) => {
    const url = new URL(req.url);
    const path = target.replace(/\[(\w+)\]/g, (_m, key: string) => encodeURIComponent(String(ctx?.params?.[key] || '')));
    return NextResponse.redirect(new URL(path + url.search, url.origin), 308);
  };
}
