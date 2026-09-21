import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "purple" | "neutral" | "primary";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success-tint text-success border-success-border",
  warning: "bg-warning-tint text-warning border-warning-border",
  danger: "bg-danger-tint text-danger border-danger-border",
  info: "bg-info-tint text-info border-info-border",
  purple: "bg-purple-tint text-purple border-purple-border",
  primary: "bg-primary-tint text-primary border-primary-border",
  neutral: "bg-panel text-text-2 border-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 text-[11px] font-semibold leading-none",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: BadgeTone }) {
  const color: Record<BadgeTone, string> = {
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
    purple: "var(--purple)",
    primary: "var(--primary)",
    neutral: "var(--text-3)",
  };
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color[tone] }} />;
}
