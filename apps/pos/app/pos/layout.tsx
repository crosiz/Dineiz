import POSLayout from './POSLayout';

export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <POSLayout>{children}</POSLayout>;
}
