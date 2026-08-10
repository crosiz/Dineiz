import ExcelJS from 'exceljs';

// Convert JSON Data to CSV string
export function generateCSV(data: any): string {
  if (!data) return '';
  
  if (data.shifts && Array.isArray(data.shifts)) {
    // It's Shift Balance Report
    const header = 'Date,Cashier,Branch,Opening Float,Cash Orders,Card Orders,Total Revenue,Closing Cash Entered,Expected Cash,Variance,Status,Notes\n';
    const rows = data.shifts.map((s: any) => 
      `${s.date},"${s.cashier}","${s.branch}",${s.openingFloat},${s.cashOrders},${s.cardOrders},${s.totalRevenue},${s.closingCashEntered},${s.expectedCash},${s.variance},${s.status},"${s.notes}"`
    ).join('\n');
    return header + rows;
  }
  
  if (data.totalGrossRevenue !== undefined) {
    // It's Tax Report
    return `Period,Total Gross Revenue,Taxable Revenue,Non-Taxable Revenue,Cash Tax Collected,Card Tax Collected,Total Tax Collected,FBR Invoice Range\n` +
           `"${data.period}",${data.totalGrossRevenue},${data.taxableRevenue},${data.nonTaxableRevenue},${data.cashTaxCollected},${data.cardTaxCollected},${data.totalTaxCollected},"${data.fbrInvoiceRange}"`;
  }
  
  return JSON.stringify(data);
}

// Convert JSON Data to Excel Buffer
export async function generateExcel(data: any, reportName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dineiz Reports Module';
  const worksheet = workbook.addWorksheet('Report Data');

  if (data.shifts && Array.isArray(data.shifts)) {
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Cashier', key: 'cashier', width: 20 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Opening Float', key: 'openingFloat', width: 15 },
      { header: 'Cash Orders', key: 'cashOrders', width: 15 },
      { header: 'Card Orders', key: 'cardOrders', width: 15 },
      { header: 'Total Revenue', key: 'totalRevenue', width: 15 },
      { header: 'Closing Cash Entered', key: 'closingCashEntered', width: 20 },
      { header: 'Expected Cash', key: 'expectedCash', width: 15 },
      { header: 'Variance', key: 'variance', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 }
    ];
    worksheet.addRows(data.shifts);
    worksheet.addRow({
      date: 'TOTAL',
      openingFloat: data.totals.openingFloat,
      cashOrders: data.totals.cashOrders,
      cardOrders: data.totals.cardOrders,
      totalRevenue: data.totals.totalRevenue,
      closingCashEntered: data.totals.closingCashEntered,
      expectedCash: data.totals.expectedCash,
      variance: data.totals.variance
    });
  } else if (data.totalGrossRevenue !== undefined) {
    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 40 }
    ];
    worksheet.addRows([
      { metric: 'Period', value: data.period },
      { metric: 'Total Gross Revenue', value: data.totalGrossRevenue },
      { metric: 'Taxable Revenue', value: data.taxableRevenue },
      { metric: 'Non-Taxable Revenue', value: data.nonTaxableRevenue },
      { metric: 'Cash Tax Collected', value: data.cashTaxCollected },
      { metric: 'Card Tax Collected', value: data.cardTaxCollected },
      { metric: 'Total Tax Collected', value: data.totalTaxCollected },
      { metric: 'FBR Invoice Range', value: data.fbrInvoiceRange }
    ]);
  } else {
    worksheet.addRow(['No specific format defined for this report']);
  }

  // Add bold styling to headers
  worksheet.getRow(1).font = { bold: true };
  
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as any as Buffer;
}

// Mock PDF Generation
// In a real environment, this would HTTP POST to the pdf-worker microservice and upload to Cloudinary.
export async function generatePDF(data: any, reportName: string): Promise<string> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return a mock Cloudinary URL
  const randomId = Math.random().toString(36).substring(7);
  return `https://res.cloudinary.com/demo/image/upload/v1234567890/dineiz/reports/${reportName.replace(/\\s+/g, '_')}_${randomId}.pdf`;
}

export async function generatePDFBuffer(reportType: string, data: any, branding?: any): Promise<Buffer> {
  // Mock PDF buffer generation
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Title (${reportType}) >>\nendobj\n%%EOF`);
}
