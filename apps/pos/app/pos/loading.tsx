import { ScreenLoader } from '@/components/ui/ScreenLoader';

// Fallback for a hard load of any /pos segment before its chunk is ready.
// Renders inside the persistent POS shell, so it lines up with where real
// screen content appears. Rare in practice — POSLayout prefetches every route
// bundle right after login — but it means a cold segment never flashes blank.
export default function PosLoading() {
  return <ScreenLoader />;
}
