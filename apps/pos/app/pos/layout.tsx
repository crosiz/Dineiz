import POSLayout from './POSLayout';

// No `force-dynamic`: this layout renders only the client shell (POSLayout) and
// has no server-side data. Forcing dynamic made the App Router refetch every
// `/pos/*` segment's RSC payload on every tab switch, which — with `loading.tsx`
// present — flashed the skeleton on every navigation even though the screens
// hydrate instantly from `useViews`. Letting the router cache these trivial
// segments makes tab switches instant; `loading.tsx` now only shows on a
// genuine cold segment load.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <POSLayout>{children}</POSLayout>;
}
