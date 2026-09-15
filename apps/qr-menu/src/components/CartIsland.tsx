import React, { useEffect, useMemo, useState } from "react";

type Line = { id: string; name: string; price: number; qty: number };

function formatPKR(n: number) {
  return `PKR ${Math.round(n).toLocaleString("en-US")}`;
}

interface CartIslandProps {
  apiUrl: string;
  tenantId: string | null;
  branchId: string | null;
  tableId: string | null;
  allowModifications?: boolean;
}

export default function CartIsland({ apiUrl, tenantId, branchId, tableId }: CartIslandProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

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
  const canOrder = !!tenantId && !!branchId && !!tableId;

  const updateQty = (id: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0)
    );
  };

  const handleCheckout = async () => {
    if (!canOrder || lines.length === 0) return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiUrl}/api/qr/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          branchId,
          tableId,
          customerName: customerName.trim() || undefined,
          items: lines.map((l) => ({ itemId: l.id, quantity: l.qty })),
          paymentMethod: "CASH",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not place your order. Please try again.");
      }
      setOrderNumber(data.order?.orderNumber ?? null);
      setStatus("success");
      setLines([]);
      setCustomerName("");
    } catch (e: any) {
      setStatus("error");
      setErrorMessage(e?.message || "Could not place your order. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div style={{ border: "1px solid #334155", borderRadius: 16, background: "#0f172a", padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>✓</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8, color: "#f1f5f9" }}>Order sent to the kitchen</div>
        {orderNumber && (
          <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
            Order <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{orderNumber}</span>
          </div>
        )}
        <button
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid #334155",
            background: "transparent",
            color: "#f1f5f9",
            fontWeight: 700,
            cursor: "pointer",
          }}
          onClick={() => setStatus("idle")}
        >
          Order more
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #334155", borderRadius: 16, background: "#0f172a", padding: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9" }}>Your cart</div>

      {!canOrder && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#1e293b", color: "#fbbf24", fontSize: 12 }}>
          Scan the QR code at your table to place an order.
        </div>
      )}

      {lines.length === 0 ? (
        <div style={{ marginTop: 14, color: "#64748b", fontSize: 13 }}>Cart is empty.</div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.name}
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{formatPKR(l.price)} each</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => updateQty(l.id, -1)}
                  aria-label={`Remove one ${l.name}`}
                  style={{ width: 24, height: 24, borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#f1f5f9", cursor: "pointer" }}
                >
                  −
                </button>
                <span style={{ minWidth: 16, textAlign: "center", fontSize: 13, color: "#f1f5f9" }}>{l.qty}</span>
                <button
                  onClick={() => updateQty(l.id, 1)}
                  aria-label={`Add one more ${l.name}`}
                  style={{ width: 24, height: 24, borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#f1f5f9", cursor: "pointer" }}
                >
                  +
                </button>
              </div>
              <div style={{ fontWeight: 800, color: "#f1f5f9", minWidth: 64, textAlign: "right" }}>{formatPKR(l.price * l.qty)}</div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid #334155", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#94a3b8" }}>Subtotal</div>
            <div style={{ fontWeight: 900, color: "#f97316" }}>{formatPKR(subtotal)}</div>
          </div>

          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Your name (optional)"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#0b1220",
              color: "#f1f5f9",
              fontSize: 13,
              outline: "none",
            }}
          />

          {status === "error" && errorMessage && (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#1e1215", color: "#fca5a5", fontSize: 12 }}>
              {errorMessage}
            </div>
          )}

          <button
            disabled={!canOrder || status === "submitting"}
            style={{
              marginTop: 2,
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "none",
              cursor: canOrder && status !== "submitting" ? "pointer" : "not-allowed",
              fontWeight: 900,
              background: "#ea580c",
              color: "#fff",
              opacity: !canOrder || status === "submitting" ? 0.6 : 1,
            }}
            onClick={handleCheckout}
          >
            {status === "submitting" ? "Placing order…" : "Send to Kitchen"}
          </button>
        </div>
      )}
    </div>
  );
}
