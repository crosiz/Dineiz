interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
  collapsed?: boolean;
}

export function SidebarSection({ label, children, collapsed }: SidebarSectionProps) {
  return (
    <div className="mb-1">
      {!collapsed && (
        <p
          className="uppercase text-[9.5px] font-black tracking-[0.14em] px-3 pt-4 pb-1.5 truncate"
          style={{ color: '#334155', letterSpacing: '0.14em' }}
        >
          {label}
        </p>
      )}
      {collapsed && <div className="h-3" />}
      <div className="space-y-0">{children}</div>
    </div>
  );
}
