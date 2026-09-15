export interface SelectedVariation {
  id: string;
  name: string;
  price: number;
}

export interface SelectedAddOn {
  id: string;
  name: string;
  price: number;
}

export interface CartLineInput {
  itemId: string;
  name: string;
  basePrice: number;
  quantity: number;
  variation?: SelectedVariation | null;
  addOns?: SelectedAddOn[];
  notes?: string;
}

export function computeUnitPrice(line: Pick<CartLineInput, 'basePrice' | 'variation' | 'addOns'>): number {
  const variationPrice = line.variation?.price ?? 0;
  const addOnsTotal = (line.addOns ?? []).reduce((sum, addOn) => sum + addOn.price, 0);
  return line.basePrice + variationPrice + addOnsTotal;
}

export function computeLineSubtotal(line: CartLineInput): number {
  return computeUnitPrice(line) * line.quantity;
}

/**
 * Includes sorted add-on ids, unlike the cloud POS's cartKey (itemId+variationId
 * only) — there, two lines of the same item+variation with different add-ons
 * silently merge into one line instead of staying separate. Deliberate fix.
 */
export function cartLineKey(itemId: string, variationId?: string | null, addOnIds?: string[]): string {
  const sortedAddOns = [...(addOnIds ?? [])].sort().join(',');
  return `${itemId}::${variationId ?? 'base'}::${sortedAddOns}`;
}

export function computeCartSubtotal(lines: CartLineInput[]): number {
  return lines.reduce((sum, line) => sum + computeLineSubtotal(line), 0);
}
