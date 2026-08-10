import React from "react";

interface DineizLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark";
  showWordmark?: boolean;
  className?: string;
}

// Actual pixel sizes for the rendered logo
const SIZES = {
  sm:  { height: 24, symbolSize: 24 },
  md:  { height: 32, symbolSize: 30 },
  lg:  { height: 40, symbolSize: 38 },
  xl:  { height: 52, symbolSize: 48 },
};

/**
 * DineizLogo
 *
 * When `showWordmark` is true  → renders the full horizontal wordmark SVG
 *                                 (the 800×200 asset that has symbol + "Dineiz" text)
 * When `showWordmark` is false → renders just the D-mark symbol as a square icon
 *                                 (collapsed sidebar / small contexts)
 *
 * The brand SVGs have a 768×768 (or similar) canvas where the actual glyph is
 * centred.  We compensate with negative vertical margins so the visible area
 * is tight to the mark.
 */
export function DineizLogo({
  size = "md",
  variant = "dark",
  showWordmark = true,
  className = "",
}: DineizLogoProps) {
  const { height, symbolSize } = SIZES[size];

  if (showWordmark) {
    // Full horizontal logo – the SVG canvas is large, compensate vertically.
    const canvasHeight = height * 5.5;        // approximate canvas inflation
    const vOffset = -(canvasHeight - height) / 2;

    const logoSrc =
      variant === "dark"
        ? "/brand/transparent/logos/dineiz-logo-dark-bg.svg"
        : "/brand/transparent/logos/dineiz-logo-light-bg.svg";

    return (
      <div
        className={`inline-flex items-center overflow-hidden select-none shrink-0 ${className}`}
        style={{ height, minWidth: 0 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Dineiz"
          draggable={false}
          className="pointer-events-none select-none"
          style={{
            height: canvasHeight,
            width: "auto",
            marginTop: vOffset,
            marginBottom: vOffset,
            maxWidth: "none",
          }}
        />
      </div>
    );
  }

  // ── Symbol / Monogram (collapsed state) ─────────────────────────────────────
  // Render a crisp, square symbol mark in a rounded container.
  const symbolSrc =
    variant === "dark"
      ? "/brand/transparent/symbols/dineiz-symbol-dark-bg.svg"
      : "/brand/transparent/symbols/dineiz-symbol-light-bg.svg";

  // The symbol SVG has a lot of padding too – crop tightly.
  const symbolCanvas = symbolSize * 1.7;
  const symbolOffset = -(symbolCanvas - symbolSize) / 2;

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden select-none shrink-0 rounded-lg ${className}`}
      style={{
        width: symbolSize + 8,
        height: symbolSize + 8,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={symbolSrc}
        alt="Dineiz"
        draggable={false}
        className="pointer-events-none select-none"
        style={{
          width: symbolCanvas,
          height: symbolCanvas,
          marginTop: symbolOffset,
          marginBottom: symbolOffset,
          marginLeft: symbolOffset,
          marginRight: symbolOffset,
          maxWidth: "none",
          flexShrink: 0,
        }}
      />
    </div>
  );
}
