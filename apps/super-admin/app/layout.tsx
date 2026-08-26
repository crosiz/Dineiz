import type { Metadata } from 'next';
import './globals.css';
import AdminLayout from '@/components/AdminLayout';

export const metadata: Metadata = {
  title: 'Dineiz Super Admin Dashboard',
  description: 'Internal Operations Dashboard for Dineiz Platform Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-surface-base text-slate-900">
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
