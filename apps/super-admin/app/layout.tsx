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
      <body className="antialiased bg-slate-900 text-slate-100">
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
