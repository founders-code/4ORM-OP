import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0B1220' }}>
      <SignUp routing="hash" />
    </main>
  );
}
