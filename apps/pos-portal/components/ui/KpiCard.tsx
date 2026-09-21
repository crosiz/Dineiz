import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = "success",
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "danger";
  icon: LucideIcon;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-2">{label}</span>
        <Icon className="h-4 w-4 text-text-3" strokeWidth={1.75} />
      </div>
      <div className="flex items-end justify-between">
        <span className="tabular text-2xl font-bold text-text-1">{value}</span>
        {delta && (
          <span
            className={cn(
              "tabular flex items-center gap-0.5 text-xs font-semibold",
              deltaTone === "success" ? "text-success" : "text-danger"
            )}
          >
            {deltaTone === "success" ? (
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {delta}
          </span>
        )}
      </div>
    </Card>
  );
}
