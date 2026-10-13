import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

const page = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: '#fff',
  color: '#102033',
  fontFamily: 'system-ui, sans-serif',
} as const;

export default function Page() {
  return (
    <main style={page}>
      <div style={{ width: 'min(420px, 100%)', textAlign: 'center' }}>
        <img src="/assets/4orm-header-logo.png" alt="4orm Finance" style={{ width: 168, height: 'auto', margin: '0 auto 28px' }} />
        <h1 style={{ margin: '0 0 8px', fontSize: 40, lineHeight: 1.05, letterSpacing: '-0.03em' }}>Where Legends Come to Build</h1>
        <p style={{ margin: '0 0 28px', fontSize: 18, color: '#5C6B7A' }}>Operations</p>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <SignIn routing="hash" />
        ) : (
          <p>Sign-in activates once Clerk keys are set.</p>
        )}
      </div>
    </main>
  );
}
