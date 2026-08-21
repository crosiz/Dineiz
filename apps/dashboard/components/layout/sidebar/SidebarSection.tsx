interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
  collapsed?: boolean;
}

export function SidebarSection({ label, children, collapsed }: SidebarSectionProps) {
  return (
    <div className="mb-2">
      {!collapsed ? (
        <div className="px-2.5 pt-3 pb-1 select-none">
          <span className="uppercase text-[10px] font-bold tracking-widest text-zinc-500 font-mono">
            {label}
          </span>
        </div>
      ) : (
        <div className="my-2 mx-3 border-t border-zinc-800/80" />
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}



