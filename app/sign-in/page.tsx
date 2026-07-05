import { SignIn } from '@clerk/nextjs';

// Hash routing keeps this a single plain folder (no bracketed catch-all route),
// which uploads cleanly to GitHub and other tools.
export default function Page() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0B1220' }}>
      <SignIn routing="hash" />
    </main>
  );
}
