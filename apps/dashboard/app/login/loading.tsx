export default function LoginLoading() {
  return (
    <div
      className="w-full max-w-[1200px] grid lg:grid-cols-2 rounded-xl shadow-2xl overflow-hidden"
      style={{ minHeight: 700, background: "#ffffff" }}
    >
      {/* Left panel skeleton */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12"
        style={{ background: "#0f172a" }}
      >
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: "#ff5722" }} />
            <div className="h-6 w-28 rounded animate-pulse bg-slate-700" />
          </div>
          <div className="mt-12 space-y-3">
            <div className="h-8 w-64 rounded animate-pulse bg-slate-700" />
            <div className="h-8 w-48 rounded animate-pulse bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="flex flex-col justify-center items-center p-12">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="space-y-2">
            <div className="h-9 w-44 rounded animate-pulse bg-slate-100" />
            <div className="h-4 w-72 rounded animate-pulse bg-slate-100" />
          </div>
          <div className="space-y-4">
            <div className="h-12 w-full rounded-lg animate-pulse bg-slate-100" />
            <div className="h-12 w-full rounded-lg animate-pulse bg-slate-100" />
            <div className="h-12 w-full rounded-lg animate-pulse" style={{ background: "#ff5722", opacity: 0.3 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
