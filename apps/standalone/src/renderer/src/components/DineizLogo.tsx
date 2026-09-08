import dineizLogo from '../assets/dineiz-logo.svg'
import dineizSymbol from '../assets/dineiz-symbol.svg'

interface DineizLogoProps {
  height?: number
  className?: string
}

// Exact cropping math ported from apps/pos/components/ui/DineizLogo.tsx —
// same source SVG (a 768x768 canvas with ~90px of left padding baked in),
// so the same crop keeps the wordmark tight without re-deriving it.
export default function DineizLogo({ height = 28, className = '' }: DineizLogoProps) {
  const canvasMultiplier = 5.2
  const canvasHeight = height * canvasMultiplier
  const vOffset = -(canvasHeight - height) / 2
  const hLeftOffset = -(canvasHeight * 0.117)

  return (
    <div className={`relative inline-flex shrink-0 items-center overflow-hidden ${className}`} style={{ height }}>
      <img
        src={dineizLogo}
        alt="Dineiz"
        draggable={false}
        className="pointer-events-none select-none"
        style={{
          height: canvasHeight,
          width: 'auto',
          marginTop: vOffset,
          marginBottom: vOffset,
          marginLeft: hLeftOffset,
          maxWidth: 'none'
        }}
      />
    </div>
  )
}

/** The bare "D" mark alone, no wordmark — for tight spaces (activation screen, splash states). */
export function DineizSymbol({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={dineizSymbol} alt="Dineiz" draggable={false} className={`select-none ${className}`} style={{ height: size, width: size }} />
}
