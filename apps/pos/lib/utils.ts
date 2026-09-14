// Rounded, thousands-grouped, no currency symbol — for contexts that
// already establish the currency elsewhere (a receipt's "AMT" column
// header, printed once, not on every line).
export function formatAmount(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatPKR(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'PKR 0';
  return `PKR ${formatAmount(num)}`;
}
