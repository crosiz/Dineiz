import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Dineiz — Restaurant POS Pakistan";
  const desc =
    searchParams.get("desc") ||
    "The POS system that runs your restaurant. Billing, KDS, inventory & WhatsApp AI ordering.";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#0D1117",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          backgroundImage:
            "radial-gradient(circle at 80% 20%, #1A1F2E 0%, #0D1117 80%)",
        }}
      >
        {/* Top Brand Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #FF6B35 0%, #E63946 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "28px",
              fontWeight: 900,
            }}
          >
            D
          </div>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 800,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Dineiz<span style={{ color: "#FF6B35" }}>.</span>
          </span>
        </div>

        {/* Center Title & Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#94A3B8",
              lineHeight: 1.4,
            }}
          >
            {desc}
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "18px",
            color: "#FF6B35",
            fontWeight: 700,
          }}
        >
          <span>https://dineiz.com</span>
          <span style={{ color: "#64748B", fontWeight: 500 }}>
            Pakistan's #1 Restaurant POS & Billing SaaS
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
