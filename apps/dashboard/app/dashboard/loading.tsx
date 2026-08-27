import { PageLoader } from '@/components/ui/Spinner';

// Route-level fallback for a hard load of any dashboard segment. It renders
// inside the persistent layout's content column, so it lines up exactly with
// where the real page content appears — same skeleton a soft navigation shows.
export default function DashboardLoading() {
  return <PageLoader />;
}
