import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPersistedPrinter, sendToPrinter } from './printer/webusb';
import { buildReceipt, buildKOT, buildCancellationKOT, type PrintOrder } from './printer/templates';
import { useBrandingStore } from './branding-store';
import { useTerminalSettings } from './terminal-settings';

export type PrintDocumentType = 'KOT' | 'CUSTOMER_BILL' | 'PAID_RECEIPT' | 'CANCELLATION_KOT' | 'SHIFT_REPORT' | 'TEST_PRINT';

// We reuse the PrintOrder type but can extend it for specific docs if needed
export async function printDocument(type: PrintDocumentType, data: PrintOrder & { cancellationReason?: string, cancelledBy?: string, approvedBy?: string }): Promise<void> {
  // 1. Resolve Print Mode.
  // The printer + paper width are TERMINAL-LOCAL (spec Part 9) — a device
  // with a thermal printer attached and one without can't share one setting.
  // So the terminal's own choice (Settings → Printer) wins when it's been
  // set to PRINTER; otherwise fall back to the tenant/branding default,
  // which stays PDF unless the console explicitly turned it off.
  let printMode = 'PRINTER';
  const branding = useBrandingStore.getState().branding;
  const terminal = useTerminalSettings.getState().settings;

  if (terminal.printMode === 'PRINTER') {
    printMode = 'PRINTER';
  } else if (terminal.printMode === 'PDF') {
    printMode = 'PDF';
  } else if (branding.downloadPdfReceipt) {
    printMode = 'PDF';
  } else {
    try {
      const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
      // Default to PDF when the key has never been set. The Admin panel's
      // toggle shows "PDF Mode: ON" by default on a fresh terminal
      // (`usePDFMode !== false`) — this used to check `=== true` instead,
      // so an unset key took the USB path here while the UI claimed PDF
      // mode, and every print on a fresh terminal failed with "No thermal
      // printer paired" until someone found and re-toggled the switch.
      if (settings.printing?.usePDFMode !== false) {
        printMode = 'PDF';
      }
    } catch (e) {
      printMode = 'PDF';
    }
  }

  // 2. Route to Mode
  if (printMode === 'PRINTER') {
    await executeUsbPrint(type, data);
  } else {
    await executePdfPrint(type, data);
  }
}

// ─── USB / ESC/POS PRINTER EXECUTION ─────────────────────────────────────────

async function executeUsbPrint(type: PrintDocumentType, data: PrintOrder) {
  // Only ever reconnect to an already-paired device here. requestDevice()
  // (the picker dialog) requires a direct, synchronous user gesture — it can
  // never succeed when called from this auto-print path, which always runs
  // after an awaited order-creation request. Pairing happens explicitly via
  // the Connect Printer action in Settings/Admin (see usePrinter.ts), which
  // calls requestPrinter() directly from a click handler.
  const device = await getPersistedPrinter();
  if (!device) {
    throw new Error('No thermal printer paired. Connect one in Settings before printing.');
  }

  let bytes: Uint8Array;
  switch (type) {
    case 'KOT':
      bytes = buildKOT(data);
      break;
    case 'CANCELLATION_KOT':
      bytes = buildCancellationKOT(data, data.items[0], (data as any).cancellationReason || 'No reason');
      break;
    case 'CUSTOMER_BILL':
    case 'PAID_RECEIPT':
    case 'SHIFT_REPORT': // Not fully mapped to ESC/POS yet, fallback to receipt
    case 'TEST_PRINT':
      bytes = buildReceipt(data);
      break;
    default:
      bytes = buildReceipt(data);
  }

  await sendToPrinter(device, bytes);
}

// ─── PDF PRINTER EXECUTION ───────────────────────────────────────────────────

async function executePdfPrint(type: PrintDocumentType, data: any) {
  const branding = useBrandingStore.getState().branding;
  // Terminal's own paper width wins (Settings → Printer); branding is the
  // fallback (it also carries the tenant-wide A4 option, which the terminal
  // setting doesn't expose).
  const terminalPaper = useTerminalSettings.getState().settings.paperWidth;
  const paper: string = terminalPaper || branding.receiptPaperSize || '80mm';
  if (paper === '58mm') PAPER_WIDTH = 58;
  else if (paper === 'A4') PAPER_WIDTH = 210;
  else PAPER_WIDTH = 80;
  
  let doc: jsPDF;

  switch (type) {
    case 'KOT':
      doc = await generateKOT(data);
      break;
    case 'CUSTOMER_BILL':
      doc = await generateCustomerBill(data);
      break;
    case 'PAID_RECEIPT':
      doc = await generatePaidReceipt(data);
      break;
    case 'CANCELLATION_KOT':
      doc = await generateCancellationKOT(data);
      break;
    case 'SHIFT_REPORT':
    case 'TEST_PRINT':
      // Basic placeholder implementation for others
      doc = new jsPDF({ format: [80, 200] });
      doc.text(`Doc Type: ${type}`, 10, 10);
      break;
    default:
      throw new Error(`Unknown print type: ${type}`);
  }

  // Determine filename
  const time = data.createdAt ? new Date(data.createdAt).toTimeString().substring(0,5) : '00:00';
  const orderStr = data.orderNumber || data.tokenNumber || 'UNKNOWN';
  
  let filename = 'document.pdf';
  if (type === 'KOT') filename = `KOT-${orderStr}-${time.replace(':','-')}.pdf`;
  else if (type === 'CUSTOMER_BILL') filename = `BILL-${data.tableLabel ? 'T'+data.tableLabel : orderStr}.pdf`;
  else if (type === 'PAID_RECEIPT') filename = `RECEIPT-${orderStr}-${data.paymentMethod || 'CASH'}.pdf`;
  else if (type === 'CANCELLATION_KOT') filename = `CANCEL-${orderStr}.pdf`;

  doc.save(filename);
}

// ─── PDF TEMPLATES ───────────────────────────────────────────────────────────

let PAPER_WIDTH = 80;
const DASHES = '--------------------------------';
const FONT = 'courier';
const MARGIN = 5;

// Thermal receipts are a continuous roll, not a fixed page — there's no
// "next page" to overflow onto. A hardcoded page height silently clips
// whatever is drawn past it (the TOTAL row and footer, most often) with no
// error. Every generator estimates its own content height up front instead.
function createBaseDoc(estimatedHeightMm = 200) {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAPER_WIDTH, Math.max(120, Math.ceil(estimatedHeightMm))]
  });
}

// Generous, intentionally over- rather than under-estimated — a little
// trailing blank space on a downloaded PDF is harmless, a clipped total is not.
function estimateItemsHeight(items: any[]): number {
  return (items || []).reduce((sum, item) => {
    let lines = 1; // item name (assume up to ~1 wrap on average)
    if (item.variationName) lines += 1;
    if (item.addOnNames?.length) lines += item.addOnNames.length;
    if (item.notes) lines += 1;
    return sum + lines * 4.5 + 2;
  }, 0);
}

async function loadImageAsBase64(url: string, size = 240): Promise<string | null> {
  if (typeof window === 'undefined' || !url) return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadLogoAsBase64(): Promise<string | null> {
  return loadImageAsBase64('/images/dineiz-receipt-logo.svg', 240);
}

function getTenantName(fallback: string): string {
  const branding = useBrandingStore.getState().branding;
  if (branding.restaurantName) return branding.restaurantName;
  return fallback;
}

function printRow(doc: jsPDF, leftText: string, rightText: string, y: number) {
  doc.text(leftText, MARGIN, y);
  doc.text(rightText, PAPER_WIDTH - MARGIN, y, { align: 'right' });
}

async function addFooter(doc: jsPDF, y: number, showThankYou = false) {
  if (showThankYou) {
    doc.setFont(FONT, 'italic');
    doc.text('Thank you for dining with us!', PAPER_WIDTH / 2, y, { align: 'center' });
    y += 4;
    doc.setFont(FONT, 'normal');
    doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
  }
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.setFont(FONT, 'normal');
  
  const poweredBy = 'POWERED BY';
  const logoBase64 = await loadLogoAsBase64();
  
  if (logoBase64) {
    // Dynamically calculate width to perfectly center both text and logo inline
    const textWidth = doc.getTextWidth(poweredBy);
    const logoSize = 16; // Increased to 16mm as requested
    const gap = 0.5; // Reduced gap so it looks like it's written as one block
    const totalWidth = textWidth + gap + logoSize;
    const startX = (PAPER_WIDTH - totalWidth) / 2;
    
    // Draw text with left alignment at calculated startX (y is text baseline)
    doc.text(poweredBy, startX, y);
    // Vertically center the 16mm logo with the text. Text is ~3mm tall. 
    // We want the middle of the logo to align with the middle of the text.
    doc.addImage(logoBase64, 'PNG', startX + textWidth + gap, y - (logoSize / 2) - 1, logoSize, logoSize);
  } else {
    doc.text('POWERED BY DINEIZ', PAPER_WIDTH / 2, y, { align: 'center' });
  }
  doc.setTextColor(0);
}

// Template 1 — KOT
async function generateKOT(data: any) {
  const estimatedHeight = 40 + estimateItemsHeight(data.items) + (data.notes ? 20 : 0) + 25;
  const doc = createBaseDoc(estimatedHeight);
  let y = 10;

  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  const tenantName = getTenantName(data.tenantName || 'Dineiz');
  doc.text(tenantName, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;
  
  doc.setFontSize(10);
  doc.setFont(FONT, 'normal');
  doc.text('KITCHEN ORDER TICKET', PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;
  doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  printRow(doc, 'Order', `#${data.tokenNumber || data.orderNumber}`, y);
  y += 4.5;
  printRow(doc, 'Type', data.type || 'DINE-IN', y);
  y += 4.5;
  if (data.tableLabel) {
    printRow(doc, 'Table', `T-${data.tableLabel}`, y);
    y += 4.5;
  }
  const timeStr = data.createdAt ? new Date(data.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
  printRow(doc, 'Time', timeStr, y);
  y += 4.5;
  if (data.cashierName) {
    printRow(doc, 'Waiter', data.cashierName, y);
    y += 4.5;
  }
  doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  // Items
  doc.setFont(FONT, 'bold');
  printRow(doc, 'QTY  ITEM', '', y);
  y += 5;
  doc.setFont(FONT, 'normal');

  data.items.forEach((item: any) => {
    doc.setFont(FONT, 'bold');
    doc.text(`${item.quantity}x`, MARGIN, y);
    doc.setFont(FONT, 'normal');
    
    // Auto-wrap item name
    const itemNameLines = doc.splitTextToSize(item.name, PAPER_WIDTH - MARGIN * 2 - 10);
    itemNameLines.forEach((line: string, i: number) => {
      doc.text(line, MARGIN + 10, y + (i * 4));
    });
    y += (itemNameLines.length * 4) + 1;
    
    let mods = item.variationName ? `[${item.variationName}]` : '';
    if (item.addOnNames?.length) mods += ` + ${item.addOnNames.join(', ')}`;
    if (item.notes) mods += `\n* ${item.notes}`;
    
    if (mods) {
      const modLines = doc.splitTextToSize(mods, PAPER_WIDTH - MARGIN * 2 - 10);
      doc.setTextColor(100);
      modLines.forEach((line: string, i: number) => {
        doc.text(line, MARGIN + 10, y + (i * 4));
      });
      doc.setTextColor(0);
      y += (modLines.length * 4) + 1;
    }
  });

  y += 2;
  doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 6;

  if (data.notes) {
    doc.setFontSize(9);
    doc.text(`Notes: ${data.notes}`, MARGIN, y, { maxWidth: PAPER_WIDTH - MARGIN * 2 });
    y += 15;
  }

  await addFooter(doc, y);
  return doc;
}


// Helper to build Bill or Receipt
async function buildBill(data: any, isPaid: boolean) {
  const branding = useBrandingStore.getState().branding;

  const hasDualTax = !isPaid && data.dualTaxConfig?.showDualTaxOnReceipt
    && data.dualTaxConfig?.cashTaxEnabled && data.dualTaxConfig?.cardTaxEnabled;
  const estimatedHeight = 45
    + estimateItemsHeight(data.items)
    + (hasDualTax ? 70 : 35)
    + (branding.logoUrl && branding.showLogoOnReceipt ? 28 : 0)
    + (!isPaid ? 8 : 0) // "DUE BILL" banner
    + 30; // footer + "powered by"
  const doc = createBaseDoc(estimatedHeight);
  let y = 10;

  if (branding.logoUrl && branding.showLogoOnReceipt) {
    const tenantLogo = await loadImageAsBase64(branding.logoUrl, 200);
    if (tenantLogo) {
      const logoSize = 22;
      doc.addImage(tenantLogo, 'PNG', (PAPER_WIDTH - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 3;
    }
  }

  doc.setFontSize(11);
  doc.setFont(FONT, 'bold');
  const tenantName = branding.restaurantName || data.tenantName || 'Dineiz';
  doc.text(tenantName, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(9);
  doc.setFont(FONT, 'normal');
  
  if (branding.fbrNtn) {
    doc.text(`NTN: ${branding.fbrNtn}`, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 4;
  }
  
  if (branding.receiptHeader) {
    const headerLines = doc.splitTextToSize(branding.receiptHeader, PAPER_WIDTH - MARGIN * 2);
    headerLines.forEach((line: string) => {
      doc.text(line, PAPER_WIDTH / 2, y, { align: 'center' });
      y += 4;
    });
  }

  const layout = branding.receiptLayout || 'CLASSIC';
  const SEPARATOR = layout === 'MODERN' ? '================================' : '--------------------------------';

  // A CUSTOMER_BILL is printed *before* payment — nothing else on the page
  // otherwise distinguishes it from a paid receipt, so a bill left on a
  // table can be mistaken for proof of payment. Paid receipts (isPaid=true)
  // never show this.
  if (!isPaid) {
    doc.setFontSize(10);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(200, 0, 0);
    doc.text('*** DUE BILL — NOT PAID ***', PAPER_WIDTH / 2, y, { align: 'center' });
    doc.setTextColor(0);
    doc.setFont(FONT, 'normal');
    y += 6;
  }

  doc.setFontSize(10);
  doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  if (layout === 'MODERN') {
    doc.setFont(FONT, 'bold');
    doc.text('ORDER INFO', PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
    doc.setFont(FONT, 'normal');
  }

  printRow(doc, 'Order', `#${data.orderNumber || data.tokenNumber}`, y);
  y += 4.5;
  const dt = data.createdAt ? new Date(data.createdAt) : new Date();
  printRow(doc, 'Time', dt.toLocaleString('en-PK', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }), y);
  y += 4.5;
  if (data.tableLabel) {
    printRow(doc, 'Table', `T-${data.tableLabel}`, y);
    y += 4.5;
  }
  if (data.cashierName) {
    printRow(doc, 'Cashier', data.cashierName, y);
    y += 4.5;
  }
  doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  if (layout === 'MODERN') {
    doc.setFont(FONT, 'bold');
    doc.text('ITEMS', PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
  }

  const priceColX = PAPER_WIDTH - MARGIN - (PAPER_WIDTH <= 58 ? 12 : 16);

  if (layout !== 'MINIMAL') {
    doc.setFont(FONT, 'bold');
    if (layout === 'CLASSIC') {
      doc.text('#', MARGIN, y);
      doc.text('ITEM', MARGIN + 6, y);
    } else {
      doc.text('QTY  ITEM', MARGIN, y);
    }
    doc.text('PRICE', priceColX, y, { align: 'right' });
    doc.text('AMT', PAPER_WIDTH - MARGIN, y, { align: 'right' });
    y += 5;
  }
  doc.setFont(FONT, 'normal');

  data.items.forEach((item: any, index: number) => {
    let prefix = item.quantity > 1 ? `${item.quantity}x ` : '';
    let name = prefix + item.name;
    if (item.variationName) name += ` (${item.variationName})`;

    // Value part
    const priceStr = Number(item.unitPrice || 0).toLocaleString();
    const amtStr = Number(item.subtotal || 0).toLocaleString();

    const nameWidth = layout === 'MINIMAL' ? (PAPER_WIDTH - MARGIN * 2 - 20) : (PAPER_WIDTH - MARGIN * 2 - 6 - (PAPER_WIDTH <= 58 ? 24 : 32));
    const lines = doc.splitTextToSize(name, Math.max(10, nameWidth));

    lines.forEach((line: string, i: number) => {
      if (i === 0) {
        if (layout === 'CLASSIC') {
          doc.text(`${index + 1}.`, MARGIN, y);
          doc.text(line, MARGIN + 6, y);
          doc.text(priceStr, priceColX, y, { align: 'right' });
          doc.text(amtStr, PAPER_WIDTH - MARGIN, y, { align: 'right' });
        } else if (layout === 'MINIMAL') {
          doc.text(line, MARGIN, y);
          doc.text(amtStr, PAPER_WIDTH - MARGIN, y, { align: 'right' });
        } else { // MODERN
          doc.text(line, MARGIN, y);
          doc.text(priceStr, priceColX, y, { align: 'right' });
          doc.text(amtStr, PAPER_WIDTH - MARGIN, y, { align: 'right' });
        }
      } else {
        doc.text(line, layout === 'CLASSIC' ? MARGIN + 6 : MARGIN, y);
      }
      y += 4.5;
    });

    // Addons — each on its own indented, greyed line with its own price so
    // the customer can see exactly what they were charged extra for
    // (the AMT column above already includes these in the item subtotal).
    if (item.addOnNames?.length) {
      const indent = layout === 'CLASSIC' ? MARGIN + 6 : MARGIN;
      doc.setFontSize(8);
      doc.setTextColor(100);
      item.addOnNames.forEach((addOnLabel: string) => {
        const addOnLines = doc.splitTextToSize(`+ ${addOnLabel}`, PAPER_WIDTH - indent - MARGIN);
        addOnLines.forEach((line: string) => {
          doc.text(line, indent, y);
          y += 4;
        });
      });
      doc.setFontSize(10);
      doc.setTextColor(0);
    }

    if (item.notes) {
      const indent = layout === 'CLASSIC' ? MARGIN + 6 : MARGIN;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont(FONT, 'italic');
      const noteLines = doc.splitTextToSize(`* ${item.notes}`, PAPER_WIDTH - indent - MARGIN);
      noteLines.forEach((line: string) => {
        doc.text(line, indent, y);
        y += 4;
      });
      doc.setFont(FONT, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0);
    }
  });

  doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  printRow(doc, 'Subtotal', `PKR ${Number(data.subtotal || 0).toLocaleString()}`, y);
  y += 4.5;

  if (data.discountAmount > 0) {
    printRow(doc, 'Discount', `-PKR ${Number(data.discountAmount).toLocaleString()}`, y);
    y += 4.5;
  }

  const config = data.dualTaxConfig;
  const taxable = Number(data.subtotal || 0) - Number(data.discountAmount || 0);
  
  const applyRounding = (val: number, method?: string) => {
    if (method === 'CEIL') return Math.ceil(val);
    if (method === 'FLOOR') return Math.floor(val);
    return Math.round(val);
  };

  if (!isPaid && config && config.showDualTaxOnReceipt && config.cashTaxEnabled && config.cardTaxEnabled) {
    // Block 1: Cash Tax
    const cashTax = applyRounding(taxable * config.cashTaxRate, config.taxRoundingMethod);
    const cashTotal = taxable + cashTax;
    
    printRow(doc, `${config.cashTaxLabel} ${config.cashTaxRate * 100}%`, `PKR ${cashTax.toLocaleString()}`, y);
    y += 4.5;
    doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
    doc.setFont(FONT, 'bold');
    printRow(doc, 'TOTAL (ON CASH)', `PKR ${cashTotal.toLocaleString()}`, y);
    doc.setFont(FONT, 'normal');
    y += 4.5;
    
    // Separator
    doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
    
    // Block 2: Card Tax
    printRow(doc, 'Subtotal', `PKR ${Number(data.subtotal || 0).toLocaleString()}`, y);
    y += 4.5;
    if (data.discountAmount > 0) {
      printRow(doc, 'Discount', `-PKR ${Number(data.discountAmount).toLocaleString()}`, y);
      y += 4.5;
    }
    const cardTax = applyRounding(taxable * config.cardTaxRate, config.taxRoundingMethod);
    const cardTotal = taxable + cardTax;
    
    printRow(doc, `${config.cardTaxLabel} ${config.cardTaxRate * 100}%`, `PKR ${cardTax.toLocaleString()}`, y);
    y += 4.5;
    doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;
    doc.setFont(FONT, 'bold');
    printRow(doc, 'TOTAL (ON CARD)', `PKR ${cardTotal.toLocaleString()}`, y);
    doc.setFont(FONT, 'normal');
    y += 4.5;
  } else {
    // Single block (either it's paid, or dual tax is off)
    let taxLabel = 'GST';
    if (config) {
      if (isPaid) {
        const isCard = ['CARD', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'ONLINE'].includes((data.paymentMethod || '').toUpperCase());
        taxLabel = isCard ? `${config.cardTaxLabel} ${config.cardTaxRate * 100}%` : `${config.cashTaxLabel} ${config.cashTaxRate * 100}%`;
      } else {
         taxLabel = `${config.cashTaxLabel} ${config.cashTaxRate * 100}%`;
      }
    }

    if (data.taxAmount > 0) {
      printRow(doc, taxLabel, `PKR ${Number(data.taxAmount).toLocaleString()}`, y);
      y += 4.5;
    }
    doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
    y += 5;

    doc.setFont(FONT, 'bold');
    printRow(doc, isPaid ? 'TOTAL' : 'TOTAL DUE', `PKR ${Number(data.total || 0).toLocaleString()}`, y);
    doc.setFont(FONT, 'normal');
    y += 4.5;
  }

  if (isPaid) {
    if (data.cashTendered && data.cashTendered > 0) {
      printRow(doc, 'Cash', `PKR ${Number(data.cashTendered).toLocaleString()}`, y);
      y += 4.5;
      printRow(doc, 'Change', `PKR ${Number(data.changeGiven || 0).toLocaleString()}`, y);
      y += 4.5;
    } else {
      printRow(doc, 'Paid via', data.paymentMethod || 'CARD', y);
      y += 4.5;
    }
  }

  doc.text(SEPARATOR, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 6;

  await addFooter(doc, y, true);

  return doc;
}

async function generateCustomerBill(data: any) {
  return await buildBill(data, false);
}

async function generatePaidReceipt(data: any) {
  return await buildBill(data, true);
}

// Template 4 — Cancellation KOT
async function generateCancellationKOT(data: any) {
  const doc = createBaseDoc();
  let y = 10;

  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(200, 0, 0);
  doc.text('CANCELLATION NOTICE', PAPER_WIDTH / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 5;
  const tenantName = getTenantName(data.tenantName || 'Dineiz');
  doc.setFontSize(10);
  doc.text(tenantName, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;
  doc.setFont(FONT, 'normal');
  doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  printRow(doc, 'Order', `#${data.orderNumber || data.tokenNumber}`, y);
  y += 4.5;
  if (data.tableLabel) {
    printRow(doc, 'Table', `T-${data.tableLabel}`, y);
    y += 4.5;
  }
  const timeStr = data.createdAt ? new Date(data.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
  printRow(doc, 'Time', timeStr, y);
  y += 6;

  doc.setFont(FONT, 'bold');
  doc.text('CANCELLED ITEMS:', MARGIN, y);
  y += 5;
  doc.setFont(FONT, 'normal');

  data.items.forEach((item: any) => {
    doc.text(`${item.quantity}x`, MARGIN, y);
    const lines = doc.splitTextToSize(item.name, PAPER_WIDTH - MARGIN * 2 - 10);
    lines.forEach((line: string, i: number) => {
      doc.text(line, MARGIN + 10, y + (i * 4));
    });
    y += (lines.length * 4) + 1;
  });

  y += 2;
  doc.text(DASHES, PAPER_WIDTH / 2, y, { align: 'center' });
  y += 5;

  printRow(doc, 'Cancelled by', data.cancelledBy || data.cashierName || 'Staff', y);
  y += 4.5;
  if (data.approvedBy) {
    printRow(doc, 'Approved by', data.approvedBy, y);
    y += 4.5;
  }

  y += 4;
  await addFooter(doc, y);

  return doc;
}
