import POSLayout from './POSLayout';

// Keep `force-dynamic`. The POS screens are client-only and localStorage /
// IndexedDB-driven — without this Next tries to statically prerender them, and
// the static HTML (no shift, no store, loading gates true) doesn't match what
// the client renders, so every page throws a hydration error and regenerates.
// (The tab-switch skeleton is a separate, smaller thing — handled per-screen,
// not by dropping this.)
export const dynamic = 'force-dynamic';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <POSLayout>{children}</POSLayout>;
}
