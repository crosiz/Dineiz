export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="#FF6B35" aria-hidden="true">
      <path d="M10 10 H50 A40 40 0 0 1 50 90 H10 Z" />
    </svg>
  );
}
