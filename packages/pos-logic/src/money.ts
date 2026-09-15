export type RoundingMethod = 'ROUND' | 'FLOOR' | 'CEIL';

export function applyRounding(value: number, method: RoundingMethod = 'ROUND'): number {
  if (method === 'FLOOR') return Math.floor(value);
  if (method === 'CEIL') return Math.ceil(value);
  return Math.round(value);
}

/** "PKR 1,234" — whole rupees, comma-grouped. Always rounds; callers never need Math.round. */
export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-US')}`;
}
