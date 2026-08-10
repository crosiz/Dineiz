/**
 * formatPKR
 * Rounds to nearest integer, comma separates, and prefixes with "PKR ".
 * e.g. 123.5 -> "PKR 124", 2450.00 -> "PKR 2,450"
 */
export function formatPKR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'PKR 0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'PKR 0';
  
  const rounded = Math.round(num);
  return `PKR ${rounded.toLocaleString('en-US')}`;
}

/**
 * formatVariance
 * Prefixes with "+" or "-" based on value.
 * e.g. 50 -> "+PKR 50", -200 -> "-PKR 200", 0 -> "PKR 0 (Balanced)"
 */
export function formatVariance(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'PKR 0 (Balanced)';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'PKR 0 (Balanced)';
  
  const rounded = Math.round(num);
  if (rounded === 0) return 'PKR 0 (Balanced)';
  
  const sign = rounded > 0 ? '+' : '-';
  const abs = Math.abs(rounded);
  return `${sign}${formatPKR(abs)}`;
}

/**
 * formatPercentage
 * Shows one decimal place maximum.
 * e.g. 15.0 -> "15%", 17.5 -> "17.5%"
 */
export function formatPercentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  
  // Use Number() to drop trailing zeros after toFixed(1)
  return `${Number(num.toFixed(1))}%`;
}

/**
 * formatAxisPKR
 * Abbreviated version for chart axis labels.
 * e.g. < 1000 -> "PKR 850", >= 1000 -> "PKR 12K", >= 100,000 -> "PKR 1.2L"
 */
export function formatAxisPKR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'PKR 0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'PKR 0';
  
  const rounded = Math.round(num);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  if (abs >= 100_000) {
    const lakhs = abs / 100_000;
    return `${sign}PKR ${Number(lakhs.toFixed(1))}L`;
  }
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}PKR ${Number(k.toFixed(1))}K`;
  }
  return `${sign}${formatPKR(abs)}`;
}
