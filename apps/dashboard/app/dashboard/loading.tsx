import { PageSkeleton } from '@/components/ui/skeleton';

// Route-level fallback for a hard load of any dashboard segment. It renders
// inside the persistent layout's content column, so it lines up exactly with
// where the real page content appears — the same skeleton a soft navigation
// shows. `stats-table` is the shape most dashboard screens land in.
export default function DashboardLoading() {
  return <PageSkeleton />;
}
