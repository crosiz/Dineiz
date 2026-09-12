export function formatPKR(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'PKR 0';
  // Whole PKR only, per the project's own currency rule — a caller passing
  // e.g. 1234.5 previously still got "PKR 1,234.5" back out of the one
  // function meant to guarantee this never happens.
  return `PKR ${Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
