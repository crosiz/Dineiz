import React from "react";

interface DineizLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark";
  showWordmark?: boolean;
  className?: string;
}

// Actual pixel sizes for the rendered logo
const SIZES = {
  sm: { height: 22, symbolSize: 22 },
  md: { height: 28, symbolSize: 28 },
  lg: { height: 36, symbolSize: 34 },
  xl: { height: 48, symbolSize: 44 },
};

/**
 * DineizLogo
 *
 * Renders the Dineiz brand logo crisply without negative margin hacks.
 * - showWordmark: true -> full horizontal brandmark (symbol + "Dineiz")
 * - showWordmark: false -> standalone monogram symbol for compact/collapsed contexts
 */
export function DineizLogo({
  size = "md",
  variant = "dark",
  showWordmark = true,
  className = "",
}: DineizLogoProps) {
  const { height, symbolSize } = SIZES[size];

  if (showWordmark) {
    const logoSrc =
      variant === "dark"
        ? "/brand/transparent/logos/dineiz-logo-dark-bg.svg"
        : "/brand/transparent/logos/dineiz-logo-light-bg.svg";

    return (
      <div
        className={`inline-flex items-center select-none shrink-0 ${className}`}
        style={{ height }}
      >
        <div
          className="relative overflow-hidden flex items-center justify-center shrink-0"
          style={{
            height,
            width: height * 3.4, // Native aspect ratio ~3.4:1
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Dineiz"
            draggable={false}
            className="pointer-events-none select-none max-w-none"
            style={{
              height: height * 4.46,
              width: "auto",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      </div>
    );
  }

  // ── Symbol / Monogram (collapsed state) ─────────────────────────────────────
  const symbolSrc =
    variant === "dark"
      ? "/brand/transparent/symbols/dineiz-symbol-dark-bg.svg"
      : "/brand/transparent/symbols/dineiz-symbol-light-bg.svg";

  const containerBg =
    variant === "dark"
      ? "bg-white/[0.06] border border-white/10"
      : "bg-slate-100/80 border border-slate-200/80";

  return (
    <div
      className={`inline-flex items-center justify-center select-none shrink-0 rounded-lg ${containerBg} ${className}`}
      style={{
        width: symbolSize + 6,
        height: symbolSize + 6,
      }}
    >
      <div
        className="relative overflow-hidden flex items-center justify-center"
        style={{
          width: symbolSize,
          height: symbolSize,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={symbolSrc}
          alt="Dineiz"
          draggable={false}
          className="pointer-events-none select-none max-w-none"
          style={{
            width: symbolSize * 1.45,
            height: symbolSize * 1.45,
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
}

