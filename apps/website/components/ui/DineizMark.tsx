/**
 * The Dineiz brand mark — a simple "D" formed from a rectangle and a
 * semicircle. Drawn as plain vector geometry (no embedded raster/masks)
 * so it renders correctly at any size, unlike the production logo files
 * in /public which are export artifacts not meant for small inline use.
 */
export function DineizMark({
  size = 24,
  color = "#FF6B35",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 15 H50 A35 35 0 0 1 50 85 H20 Z" fill={color} />
    </svg>
  );
}
