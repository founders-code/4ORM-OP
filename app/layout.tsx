import { ClerkProvider } from '@clerk/nextjs';

export const metadata = { title: '4orm Operations' };

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="en">
      <body style={{ margin: 0, background: '#0B1220' }}>{children}</body>
    </html>
  );
  // Wrap in ClerkProvider only when keys exist, so the build never fails before
  // Clerk is wired up.
  return hasClerk ? <ClerkProvider>{shell}</ClerkProvider> : shell;
}
