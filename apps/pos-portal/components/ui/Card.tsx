import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-bg", className)} {...props} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-[3px] shrink-0 rounded-sm bg-primary" />
        <span className="text-[15px] font-semibold text-text-1">{children}</span>
      </div>
      {action}
    </div>
  );
}
