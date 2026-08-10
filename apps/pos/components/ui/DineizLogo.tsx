'use client';

import React from 'react';

export interface DineizLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'dark' | 'light';
  showBadge?: boolean;
  badgeText?: string;
  className?: string;
  onClick?: () => void;
}

const SIZES = {
  sm: { height: 24, canvasMultiplier: 5.2, badgeText: 'text-[9px]' },
  md: { height: 30, canvasMultiplier: 5.2, badgeText: 'text-[10px]' },
  lg: { height: 38, canvasMultiplier: 5.2, badgeText: 'text-[11px]' },
  xl: { height: 46, canvasMultiplier: 5.2, badgeText: 'text-[11px]' },
  '2xl': { height: 54, canvasMultiplier: 5.2, badgeText: 'text-[12px]' },
};

export function DineizLogo({
  size = 'md',
  variant = 'light',
  showBadge = false,
  badgeText = 'POS',
  className = '',
  onClick,
}: DineizLogoProps) {
  const { height, canvasMultiplier, badgeText: badgeFontSize } = SIZES[size];

  // Exact vertical and horizontal cropping math for the 768x768 SVG canvas
  const canvasHeight = height * canvasMultiplier;
  const vOffset = -(canvasHeight - height) / 2;
  // Left padding in SVG is ~90px out of 768px (0.117 of canvas width)
  const hLeftOffset = -(canvasHeight * 0.117);

  const logoSrc =
    variant === 'dark'
      ? '/brand/transparent/logos/dineiz-logo-dark-bg.svg'
      : '/brand/transparent/logos/dineiz-logo-light-bg.svg';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none shrink-0 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {/* Main Logo Container - Flush Left Aligned */}
      <div
        className="relative inline-flex items-center overflow-hidden shrink-0"
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
            width: 'auto',
            marginTop: vOffset,
            marginBottom: vOffset,
            marginLeft: hLeftOffset,
            maxWidth: 'none',
          }}
        />
      </div>

      {/* Optional Badge (Only if showBadge is explicitly true) */}
      {showBadge && (
        <span
          className={`inline-flex items-center justify-center font-extrabold uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full border ${badgeFontSize} bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#FBBF24]`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}
