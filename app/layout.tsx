import { ClerkProvider } from '@clerk/nextjs';

export const metadata = { title: '4orm Operations' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, background: '#0B1220' }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
