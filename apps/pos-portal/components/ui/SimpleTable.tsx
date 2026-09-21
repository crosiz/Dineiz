import { Card } from "./Card";

export type Column<T> = {
  key: string;
  header: string;
  align?: "right";
  width?: string;
  render: (row: T) => React.ReactNode;
};

export function SimpleTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = "No records",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
}) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");
  return (
    <Card className="overflow-hidden">
      <div
        className="grid items-center gap-2 border-b border-border bg-panel px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-3"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((c) => (
          <span key={c.key} className={c.align === "right" ? "text-right" : undefined}>
            {c.header}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={rowKey(row)}
          className="grid items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] last:border-0"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((c) => (
            <span key={c.key} className={c.align === "right" ? "text-right" : undefined}>
              {c.render(row)}
            </span>
          ))}
        </div>
      ))}
      {rows.length === 0 && <div className="py-10 text-center text-xs text-text-3">{emptyText}</div>}
    </Card>
  );
}
