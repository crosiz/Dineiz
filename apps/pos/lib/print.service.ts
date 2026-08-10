import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPersistedPrinter, sendToPrinter } from './printer/webusb';
import { buildReceipt, buildKOT, buildCancellationKOT, type PrintOrder } from './printer/templates';
import { useBrandingStore } from './branding-store';

export type PrintDocumentType = 'KOT' | 'CUSTOMER_BILL' | 'PAID_RECEIPT' | 'CANCELLATION_KOT' | 'SHIFT_REPORT' | 'TEST_PRINT';

// We reuse the PrintOrder type but can extend it for specific docs if needed
export async function printDocument(type: PrintDocumentType, data: PrintOrder & { cancellationReason?: string, cancelledBy?: string, approvedBy?: string }): Promise<void> {
  // 1. Resolve Print Mode
  let printMode = 'PRINTER';
  const branding = useBrandingStore.getState().branding;
  
  if (branding.downloadPdfReceipt) {
    printMode = 'PDF';
  } else {
    try {
      const settings = JSON.parse(localStorage.getItem('pos_tenant_settings') || '{}');
      if (settings.printing?.usePDFMode === true) {
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
  let device = await getPersistedPrinter();
  if (!device) {
    const { requestPrinter } = await import('./printer/webusb');
    device = await requestPrinter();
  }
  if (!device) {
    throw new Error('No thermal printer connected or paired. Please connect in Settings.');
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
  if (branding.receiptPaperSize === '58mm') PAPER_WIDTH = 58;
  else if (branding.receiptPaperSize === 'A4') PAPER_WIDTH = 210;
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

function createBaseDoc() {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAPER_WIDTH, 200]
  });
}

async function loadLogoAsBase64(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 240; // High resolution for crisp logo
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, 240, 240);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = '/images/dineiz-receipt-logo.svg';
  });
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
  const doc = createBaseDoc();
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
  const doc = createBaseDoc();
  let y = 10;

  const branding = useBrandingStore.getState().branding;

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
    printRow(doc, 'TOTAL', `PKR ${Number(data.total || 0).toLocaleString()}`, y);
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
