export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-3.5 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-text-1">{label}</span>
        {description && <span className="text-xs text-text-3">{description}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsToggle({ enabled }: { enabled: boolean }) {
  return (
    <div className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${enabled ? "bg-primary" : "bg-border"}`}>
      <div className={`h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </div>
  );
}
