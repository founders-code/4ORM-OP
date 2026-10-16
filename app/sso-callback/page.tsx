import { Finish } from './finish';

export const dynamic = 'force-dynamic';

const page = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#fff',
  color: '#5E6E88',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Inter, system-ui, sans-serif',
  fontSize: 14,
} as const;

export default function Page() {
  return (
    <main style={page}>
      <p>Signing you in...</p>
      {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <Finish /> : null}
    </main>
  );
}
