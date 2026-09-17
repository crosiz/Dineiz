import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from './providers/QueryProvider';
import { ClientAppProvider } from '@/components/ClientAppProvider';
import { SocketProvider } from '@/contexts/SocketContext';
import '@/lib/fetch-interceptor';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Dineiz POS',
  description: 'Point of Sale terminal — Dineiz Restaurant Intelligence Platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dineiz POS',
  },
};

// One typeface, served from our own origin.
//
// The <head> used to carry two render-blocking stylesheet links — Google Fonts
// (Inter, Space Grotesk, Space Mono, Plus Jakarta Sans, JetBrains Mono) and
// api.fontshare.com (Clash Display): six families, ~16 files, two third-party
// origins, every one of them blocking first paint. On a POS tablet with no
// connectivity — the exact condition this app is built for — the browser waits
// for those requests to time out before it will paint anything.
//
// next/font downloads Inter at BUILD time and serves it from this app's own
// origin with `display: swap`, so there is no third-party request at runtime,
// nothing to block on, and it works offline. The display and mono utilities in
// globals.css now map onto Inter and the system mono stack respectively, which
// is also simply better typography than five mixed families.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // No `className="dark"`: the POS is a light-themed app and always has
    // been. That class was a leftover that made every `dark:` utility in the
    // tree apply on top of a white surface.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <SocketProvider>
            <ClientAppProvider>
              <Toaster position="top-center" richColors theme="dark" />
              {children}
            </ClientAppProvider>
          </SocketProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
