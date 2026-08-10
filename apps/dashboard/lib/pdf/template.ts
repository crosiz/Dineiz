import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function createBrandedPDF(title: string, branding: {
  restaurantName: string
  logoUrl?: string
  primaryColor: string
  address?: string
  phone?: string
  ntn?: string
}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primary = branding.primaryColor || '#FF6B35';

  // Header background strip
  doc.setFillColor(primary);
  doc.rect(0, 0, 210, 30, 'F');

  // Restaurant name white on colored header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(branding.restaurantName, 14, 12);

  doc.setFontSize(9).setFont('helvetica', 'normal');
  if (branding.address) doc.text(branding.address, 14, 18);
  if (branding.phone) doc.text(branding.phone, 14, 23);
  if (branding.ntn) doc.text(`NTN: ${branding.ntn}`, 14, 28);

  // Report title right-aligned
  doc.setFontSize(11).setFont('helvetica', 'bold');
  doc.text(title, 196, 12, { align: 'right' });
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, 196, 18, { align: 'right' });

  // Powered by Dineiz
  doc.text('Powered by Dineiz — dineiz.com', 196, 23, { align: 'right' });

  // Reset text color for body
  doc.setTextColor(30, 30, 30);

  // Return doc positioned at y=36 ready for content
  return doc;
}

export function addSectionHeading(doc: jsPDF, text: string, y: number, primaryColor: string): number {
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor);
  doc.text(text.toUpperCase(), 14, y);
  doc.setDrawColor(primaryColor);
  doc.line(14, y + 1, 196, y + 1);
  doc.setTextColor(30, 30, 30);
  return y + 8; // return next y position
}

export function addFooter(doc: jsPDF): void {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
    doc.text('Confidential — For internal use only', 14, 287);
  }
}
