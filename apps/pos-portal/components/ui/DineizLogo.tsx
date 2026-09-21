'use client';

export interface DineizLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'dark' | 'light';
  showBadge?: boolean;
  badgeText?: string;
  className?: string;
  onClick?: () => void;
  /** Just the D mark, cropped from the full logo: for narrow top bars. */
  markOnly?: boolean;
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
  markOnly = false,
}: DineizLogoProps) {
  const { height, canvasMultiplier, badgeText: badgeFontSize } = SIZES[size];

  // The D on its own: the brand's symbol file, cropped to the mark. The mark
  // fills x 24-79% and y 21.5-77% of that canvas (measured from its pixels),
  // so the image is scaled up and shifted to show exactly that square.
  if (markOnly) {
    const img = height / 0.555;
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ width: height, height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/transparent/symbols/dineiz-symbol-light-bg.svg"
          alt="Dineiz"
          draggable={false}
          className="pointer-events-none select-none absolute"
          style={{ width: img, height: img, left: -img * 0.24, top: -img * 0.215, maxWidth: 'none' }}
        />
      </div>
    );
  }

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
          className={`inline-flex items-center justify-center font-extrabold uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full border ${badgeFontSize} bg-brand/10 border-brand/30 text-warn`}
        >
          {badgeText}
        </span>
      )}
    </div>
  );
}
