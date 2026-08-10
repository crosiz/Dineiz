import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createBrandedPDF, addSectionHeading, addFooter } from './template';

export async function generateShiftReportPDF(shift: any, branding: any): Promise<void> {
  const doc = createBrandedPDF('Shift Report', branding);
  let y = 40;

  const formatDate = (d: any) => new Date(d).toLocaleDateString('en-PK');
  const formatTime = (d: any) => new Date(d).toLocaleTimeString('en-PK');
  const formatDateTime = (d: any) => `${formatDate(d)} ${formatTime(d)}`;
  const formatPKR = (amount: number) => `PKR ${amount.toLocaleString()}`;
  const formatDuration = (start: any, end: any) => {
    if (!start || !end) return '-';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  y = addSectionHeading(doc, 'Shift Summary', y, branding.primaryColor);
  autoTable(doc, {
    startY: y,
    body: [
      ['Cashier', shift.user?.name || 'Unknown'],
      ['Opened', formatDateTime(shift.openedAt)],
      ['Closed', shift.closedAt ? formatDateTime(shift.closedAt) : 'Still Open'],
      ['Duration', formatDuration(shift.openedAt, shift.closedAt)],
      ['Opening Float', formatPKR(shift.openingFloat)],
      ['Total Revenue', formatPKR(shift.totalSales ?? 0)],
      ['Variance', formatPKR(shift.cashVariance ?? 0)],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  y = addSectionHeading(doc, 'Payment Breakdown', y, branding.primaryColor);
  
  // Basic mock breakdown for compilation, assuming shift has totalSales etc.
  const buildPaymentBreakdown = (s: any) => {
    return [
      ['CASH', s.ordersServed || 0, formatPKR(s.totalSales ?? 0), '100%']
    ];
  };

  autoTable(doc, {
    startY: y,
    head: [['Method', 'Orders', 'Amount', '%']],
    body: buildPaymentBreakdown(shift),
    theme: 'striped',
    headStyles: { fillColor: branding.primaryColor, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  y = addSectionHeading(doc, 'Orders', y, branding.primaryColor);
  autoTable(doc, {
    startY: y,
    head: [['#', 'Table', 'Type', 'Method', 'Amount', 'Time']],
    body: (shift.orders || []).map((o: any) => [
      o.orderNumber, o.tableLabel ?? 'TK', o.type,
      o.payments?.[0]?.method ?? '-', formatPKR(o.netAmount),
      formatTime(o.createdAt)
    ]),
    theme: 'striped',
    headStyles: { fillColor: branding.primaryColor, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8 },
  });

  addFooter(doc);
  doc.save(`Shift-Report-${shift.user?.name || 'User'}-${formatDate(shift.openedAt).replace(/\//g, '-')}.pdf`);
}
