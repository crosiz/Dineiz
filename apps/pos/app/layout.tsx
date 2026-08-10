import type { Metadata, Viewport } from 'next';
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap"
          rel="stylesheet"
        />
        {/* Material symbols are imported in globals.css */}
      </head>
      <body suppressHydrationWarning>
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
