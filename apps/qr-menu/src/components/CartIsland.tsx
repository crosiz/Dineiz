import React, { useEffect, useMemo, useState } from "react";

type Line = { id: string; name: string; price: number; qty: number };

export default function CartIsland() {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const onAdd = (e: any) => {
      const item = e.detail as { id: string; name: string; price: number };
      setLines((prev) => {
        const existing = prev.find((l) => l.id === item.id);
        if (existing) return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
        return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
      });
    };
    window.addEventListener("qr:add-to-cart", onAdd);
    return () => window.removeEventListener("qr:add-to-cart", onAdd);
  }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);

  return (
    <div style={{ border: "1px solid #334155", borderRadius: 16, background: "#0f172a", padding: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Your cart</div>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>React island cart scaffold.</div>

      {lines.length === 0 ? (
        <div style={{ marginTop: 14, color: "#64748b", fontSize: 13 }}>Cart is empty.</div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.name}
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>x{l.qty} • Rs. {Math.round(l.price)}</div>
              </div>
              <div style={{ fontWeight: 800, color: "#f1f5f9" }}>Rs. {Math.round(l.price * l.qty)}</div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #334155", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#94a3b8" }}>Subtotal</div>
            <div style={{ fontWeight: 900, color: "#f97316" }}>Rs. {Math.round(subtotal)}</div>
          </div>
          <button
            style={{
              marginTop: 6,
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
              background: "linear-gradient(135deg,#f97316,#ea580c)",
              color: "#0b1220",
            }}
            onClick={() => alert("Checkout scaffold — integrate payments next.")}
          >
            Checkout
          </button>
        </div>
      )}
    </div>
  );
}

