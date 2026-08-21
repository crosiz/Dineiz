export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-screen w-full bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        <p className="text-sm font-medium text-text-secondary">Loading dashboard...</p>
      </div>
    </div>
  );
}
