import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

const style = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0B1220', color: '#fff', fontFamily: 'system-ui, sans-serif' } as const;

export default function Page() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main style={style}>Sign-in activates once Clerk keys are set.</main>;
  }
  return (
    <main style={style}>
      <SignIn routing="hash" />
    </main>
  );
}
