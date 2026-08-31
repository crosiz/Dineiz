/**
 * templates.ts
 * ESC/POS print templates for:
 *  1. Customer Receipt (full itemized bill with totals)
 *  2. KOT - Kitchen Order Ticket (large text, no prices, station-ready)
 */

import { EscPosBuilder } from './escpos';
import { useBrandingStore } from '../branding-store';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface PrintItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  variationName?: string;
  addOnNames?: string[];
}

export interface PrintOrder {
  orderNumber: string;
  tokenNumber: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  cashierName?: string;
  terminalName?: string; // terminal-local (Settings → This Terminal); KOT header only
  tenantName: string;
  branchName: string;
  branchAddress?: string;
  branchPhone?: string;
  items: PrintItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  cashTendered?: number;
  changeGiven?: number;
  notes?: string;
  createdAt?: Date;
  tableLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d?: Date): string {
  const dt = d ?? new Date();
  return dt.toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(n: number): string {
  return `Rs.${n.toFixed(0)}`;
}

function orderTypeLabel(type: PrintOrder['type']): string {
  return type === 'DINE_IN' ? 'Dine In' : type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery';
}

// ─── Receipt Template ─────────────────────────────────────────────────────────

/**
 * Builds a full customer receipt.
 * Layout (80mm / 48 cols):
 *
 *   [TENANT NAME]       ← centered, large
 *   Branch name
 *   Address / Phone
 *   ────────────────────
 *   Date: xx/xx/xx  Token: A12
 *   Type: Dine In   Order: ORD-1001
 *   Cashier: Name
 *   ════════════════════
 *   QTY ITEM                  PRICE
 *   ────────────────────
 *   1   Burger (Large)        Rs.450
 *       + Extra Cheese
 *       Note: no bun
 *   ────────────────────
 *   Subtotal:           Rs.450
 *   Discount:          -Rs.45
 *   Tax (13%):          Rs.53
 *   ════════════════════
 *   TOTAL:             Rs.458
 *   ════════════════════
 *   Cash:              Rs.500
 *   Change:             Rs.42
 *   ────────────────────
 *   Thank you! Visit again
 *   [CUT]
 */
export function buildReceipt(order: PrintOrder): Uint8Array {
  const p = new EscPosBuilder();
  p.init();

  const branding = useBrandingStore.getState().branding;
  let settings: any = {};
  try {
    settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
  } catch (e) {
    // Ignore outside browser
  }

  const layout = branding.receiptLayout || 'CLASSIC';

  // ── Header ──────────────────────────────────────────────────────────────
  p.center().bold().doubleSize().println(order.tenantName).normal();
  
  if (branding.receiptHeader) p.center().println(branding.receiptHeader);
  
  p.center().bold().println(order.branchName).bold(false);
  if (order.branchAddress) p.center().println(order.branchAddress);
  if (order.branchPhone)   p.center().println(`Tel: ${order.branchPhone}`);
  
  if (branding.fbrNtn) p.center().println(`NTN: ${branding.fbrNtn}`);
  if (branding.fbrPosId) p.center().println(`POS ID: ${branding.fbrPosId}`);
  
  if (layout === 'MODERN') p.doubleSeparator();
  else p.separator();

  if (layout === 'MODERN') {
    p.center().bold().println('ORDER INFO').normal();
    p.doubleSeparator();
  }

  // ── Order info ──────────────────────────────────────────────────────────
  p.left();
  p.twoCol(`Date: ${formatDate(order.createdAt)}`, `Token: ${order.tokenNumber}`);
  p.twoCol(`Type: ${orderTypeLabel(order.type)}`, `Order: ${order.orderNumber}`);
  if (branding.showTableNumber !== false && order.tableLabel) {
    p.println(`Table: T-${order.tableLabel}`);
  }
  if (branding.showCashierName !== false && order.cashierName) {
    p.println(`Cashier: ${order.cashierName}`);
  }
  if (layout === 'MODERN') p.doubleSeparator();
  else p.doubleSeparator(); // keep double for classic order info end

  if (layout === 'MODERN') {
    p.center().bold().println('ITEMS').normal();
    p.doubleSeparator();
  }

  // ── Column header ────────────────────────────────────────────────────────
  p.bold();
  if (layout === 'MINIMAL') {
    p.threeCol('QTY', 'ITEM', 'AMT');
  } else {
    p.fourCol('QTY', 'ITEM', 'PRICE', 'AMT');
  }
  p.bold(false);
  
  if (layout === 'MODERN') p.doubleSeparator();
  else p.separator();

  // ── Items ────────────────────────────────────────────────────────────────
  for (const item of order.items) {
    if (layout === 'MINIMAL') {
      p.threeCol(`${item.quantity}x`, item.name, formatCurrency(item.subtotal));
    } else {
      p.fourCol(`${item.quantity}x`, item.name, formatCurrency(item.unitPrice || 0), formatCurrency(item.subtotal));
    }

    if (item.variationName) {
      p.println(`    (${item.variationName})`);
    }
    for (const addOn of item.addOnNames ?? []) {
      p.println(`    + ${addOn}`);
    }
    if (item.notes) {
      p.println(`    * ${item.notes}`);
    }
  }
  if (layout === 'MODERN') p.doubleSeparator();
  else p.separator();

  // ── Totals ───────────────────────────────────────────────────────────────
  p.twoCol('Subtotal:', formatCurrency(order.subtotal));
  if (order.discountAmount > 0) {
    p.twoCol('Discount:', `-${formatCurrency(order.discountAmount)}`);
  }
  
  const config = settings?.tax?.dualTaxConfig || (order as any).dualTaxConfig;
  const taxable = Number(order.subtotal || 0) - Number(order.discountAmount || 0);
  const isPaid = !!order.paymentMethod;

  const applyRounding = (val: number, method?: string) => {
    if (method === 'CEIL') return Math.ceil(val);
    if (method === 'FLOOR') return Math.floor(val);
    return Math.round(val);
  };

  if (!isPaid && config && config.showDualTaxOnReceipt && config.cashTaxEnabled && config.cardTaxEnabled) {
    // Block 1: Cash Tax
    const cashTax = applyRounding(taxable * (config.cashTaxRate / 100), config.taxRoundingMethod);
    const cashTotal = taxable + cashTax;
    
    p.twoCol(`${config.cashTaxLabel} ${config.cashTaxRate}%:`, formatCurrency(cashTax));
    p.doubleSeparator();
    p.bold().doubleHeight();
    p.twoCol('TOTAL (ON CASH):', formatCurrency(cashTotal));
    p.normal();
    
    // Separator
    p.doubleSeparator();
    
    // Block 2: Card Tax
    p.twoCol('Subtotal:', formatCurrency(order.subtotal));
    if (order.discountAmount > 0) {
      p.twoCol('Discount:', `-${formatCurrency(order.discountAmount)}`);
    }
    const cardTax = applyRounding(taxable * (config.cardTaxRate / 100), config.taxRoundingMethod);
    const cardTotal = taxable + cardTax;
    
    p.twoCol(`${config.cardTaxLabel} ${config.cardTaxRate}%:`, formatCurrency(cardTax));
    p.doubleSeparator();
    p.bold().doubleHeight();
    p.twoCol('TOTAL (ON CARD):', formatCurrency(cardTotal));
    p.normal();
  } else {
    let taxLabel = 'GST:';
    if (config) {
      if (isPaid) {
        const isCard = ['CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'ONLINE'].includes((order.paymentMethod || '').toUpperCase());
        taxLabel = isCard ? `${config.cardTaxLabel} ${config.cardTaxRate * 100}%:` : `${config.cashTaxLabel} ${config.cashTaxRate * 100}%:`;
      } else {
         taxLabel = `${config.cashTaxLabel} ${config.cashTaxRate * 100}%:`;
      }
    }

    if (order.taxAmount > 0) {
      p.twoCol(taxLabel, formatCurrency(order.taxAmount));
    }
    p.doubleSeparator();

    p.bold().doubleHeight();
    p.twoCol('TOTAL:', formatCurrency(order.total));
    p.normal();
  }
  
  p.doubleSeparator();

  // ── Payment ──────────────────────────────────────────────────────────────
  if (isPaid) {
    p.twoCol('Payment:', order.paymentMethod);
    if (order.cashTendered && order.cashTendered > 0) {
      p.twoCol('Cash:', formatCurrency(order.cashTendered));
      p.twoCol('Change:', formatCurrency(order.changeGiven ?? 0));
    }
    if (layout === 'MODERN') p.doubleSeparator();
    else p.separator();
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  if (order.notes) {
    p.center().println(`Note: ${order.notes}`).left();
  }
  if (branding.receiptFooter) {
    p.center().println(branding.receiptFooter).left();
  }
  p.center().feed(1).println('Thank you! Please visit again.').feed(1);
  if (branding.receiptDisclaimer) {
    p.center().println(branding.receiptDisclaimer).feed(1);
  }
  p.center().println('Powered by Dineiz POS');

  p.cut();
  return p.build();
}

// ─── KOT Template ─────────────────────────────────────────────────────────────

/**
 * Builds a Kitchen Order Ticket.
 * Large text, no prices — optimized for kitchen readability.
 *
 *   ▌ KOT ▐   Token: A12
 *   DINE IN         ORD-1001
 *   ──────────────────────────
 *   [TIME]  Cashier: Name
 *   ══════════════════════════
 *    2x  BURGER (LARGE)
 *        Extra Cheese
 *        *** no bun ***
 *    1x  FRIES
 *   ──────────────────────────
 *   Notes: extra spicy
 *   [CUT]
 */
export function buildKOT(order: PrintOrder): Uint8Array {
  const p = new EscPosBuilder();

  p.init();

  // ── KOT Header ──────────────────────────────────────────────────────────
  p.invert().center().bold();
  p.println(` KOT  Token: ${order.tokenNumber} `);
  p.invert(false).normal();

  p.center().bold().doubleHeight();
  p.println(orderTypeLabel(order.type).toUpperCase());
  p.normal();

  p.twoCol(order.orderNumber, formatDate(order.createdAt));
  if (order.cashierName) p.println(`Cashier: ${order.cashierName}`);
  if (order.terminalName) p.println(`Terminal: ${order.terminalName}`);
  p.doubleSeparator();

  // ── Items (large text) ──────────────────────────────────────────────────
  for (const item of order.items) {
    p.left().bold().doubleHeight();
    p.println(` ${item.quantity}x  ${item.name.toUpperCase()}`);
    p.normal();

    if (item.variationName) {
      p.println(`     [${item.variationName}]`);
    }
    for (const addOn of item.addOnNames ?? []) {
      p.println(`     + ${addOn}`);
    }
    if (item.notes) {
      p.bold().println(`     *** ${item.notes} ***`).bold(false);
    }
    p.separator('·');
  }

  // ── Order notes ──────────────────────────────────────────────────────────
  if (order.notes) {
    p.bold().println(`Notes: ${order.notes}`).bold(false);
  }

  p.feed(4);
  p.cut();

  return p.build();
}

/**
 * Builds a Cancellation KOT ticket byte array (ESC/POS).
 */
export function buildCancellationKOT(order: PrintOrder, cancelledItem: PrintItem, reason: string): Uint8Array {
  const p = new EscPosBuilder();

  p.init();

  // ── KOT Header ──────────────────────────────────────────────────────────
  p.invert().center().bold();
  p.println(` VOID / CANCELLATION  Token: ${order.tokenNumber} `);
  p.normal().println();

  p.left().bold();
  p.twoCol((order as any).orderType || order.type || 'DINE-IN', order.orderNumber);

  p.left().normal();
  p.println('──────────────────────────────');

  const now = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  p.twoCol(`Time: ${now}`, `Cashier: ${order.cashierName}`);

  if (order.tableLabel) {
    p.left().bold().println(`Table: ${order.tableLabel}`);
  }
  
  p.left().normal();
  p.println('══════════════════════════════');
  p.println();

  // ── Cancelled Item ─────────────────────────────────────────────────────────
  p.bold();
  const qtyStr = `-${cancelledItem.quantity}x `;
  let nameStr = cancelledItem.name;
  if (cancelledItem.variationName) {
    nameStr += ` (${cancelledItem.variationName})`;
  }
  
  // Word wrap item name if needed, but for simplicity just print
  p.println(`${qtyStr}${nameStr}`);

  // Modifiers
  if ((cancelledItem as any).addOnNames && (cancelledItem as any).addOnNames.length > 0) {
    p.normal();
    (cancelledItem as any).addOnNames.forEach((modName: string) => {
      p.println(`    + ${modName}`);
    });
  }

  p.normal();
  p.println();
  p.println('──────────────────────────────');
  p.bold().println(`Reason: ${reason}`);
  p.normal();

  p.feed(4);
  p.cut();

  return p.build();
}
