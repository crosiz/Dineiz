import ExcelJS from 'exceljs';
import type { ReportData } from './reports.service';

type Branding = {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
};

function fmtValue(v: any): string {
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v ?? '-';
}

// Convert unified ReportData to a CSV string.
export function generateCSV(data: ReportData): string {
  const lines: string[] = [];
  lines.push(`"${data.title}"`);
  lines.push(`"${data.period}"`);
  lines.push('');

  if (data.summary?.length) {
    for (const s of data.summary) lines.push(`"${s.label}",${JSON.stringify(fmtValue(s.value))}`);
    lines.push('');
  }

  if (data.columns?.length && data.rows) {
    lines.push(data.columns.map(c => `"${c.label}"`).join(','));
    for (const row of data.rows) {
      lines.push(data.columns.map(c => JSON.stringify(row[c.key] ?? '')).join(','));
    }
    if (data.totals) {
      lines.push(data.columns.map(c => (c.key in data.totals! ? JSON.stringify(fmtValue(data.totals![c.key])) : '""')).join(','));
    }
  }

  return lines.join('\n');
}

// Convert unified ReportData to an Excel workbook buffer.
export async function generateExcel(data: ReportData, reportName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dineiz Reports Module';
  const worksheet = workbook.addWorksheet('Report Data');

  const titleRow = worksheet.addRow([data.title]);
  titleRow.font = { bold: true, size: 14 };
  worksheet.addRow([data.period]).font = { italic: true, color: { argb: 'FF666666' } };
  worksheet.addRow([]);

  if (data.summary?.length) {
    for (const s of data.summary) worksheet.addRow([s.label, s.value]);
    worksheet.addRow([]);
  }

  if (data.columns?.length && data.rows) {
    const headerRow = worksheet.addRow(data.columns.map(c => c.label));
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; });

    for (const row of data.rows) {
      worksheet.addRow(data.columns.map(c => row[c.key] ?? ''));
    }

    if (data.totals) {
      const totalsRow = worksheet.addRow(data.columns.map(c => (c.key in data.totals! ? data.totals![c.key] : (c === data.columns![0] ? 'TOTAL' : ''))));
      totalsRow.font = { bold: true };
    }

    worksheet.columns.forEach(col => { col.width = 20; });
  } else if (!data.summary?.length) {
    worksheet.addRow(['No data available for this period.']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as any as Buffer;
}

// Renders the unified ReportData as a branded HTML document — restaurant
// branding (from TenantBranding, via getTenantBranding) plus a "Powered by
// Dineiz" footer, matching the pattern already used for shift reports.
export function renderReportHtml(data: ReportData, branding: Branding): string {
  const primaryColor = branding.primaryColor || '#6366F1';
  const logoUrl = branding.logoUrl || 'https://dineiz.com/logo.png';

  const summaryHtml = data.summary?.length ? `
    <div class="section-title">Summary</div>
    <div class="summary-grid">
      ${data.summary.map(s => `
        <div class="summary-item">
          <div class="summary-label">${s.label}</div>
          <div class="summary-value">${typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const tableHtml = data.columns?.length ? `
    <div class="section-title">Details</div>
    <table>
      <thead>
        <tr>${data.columns.map(c => `<th class="${c.align === 'right' ? 'text-right' : ''}">${c.label}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${(data.rows || []).map(row => `
          <tr>${data.columns!.map(c => `<td class="${c.align === 'right' ? 'text-right' : ''}">${fmtValue(row[c.key])}</td>`).join('')}</tr>
        `).join('')}
        ${data.totals ? `
          <tr class="bold" style="border-top: 2px solid #ccc;">
            ${data.columns.map((c, i) => `<td class="${c.align === 'right' ? 'text-right' : ''}">${c.key in data.totals! ? fmtValue(data.totals![c.key]) : (i === 0 ? 'TOTAL' : '')}</td>`).join('')}
          </tr>
        ` : ''}
      </tbody>
    </table>
  ` : (!data.summary?.length ? '<p class="muted">No data available for this period.</p>' : '');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; }
        .header { display: flex; justify-content: space-between; padding: 20px 40px; height: 80px; align-items: center; }
        .logo-container img { max-height: 40px; }
        .restaurant-name { font-size: 18px; font-weight: bold; margin-top: 5px; }
        .header-right { text-align: right; }
        .report-title { font-size: 22px; font-weight: 700; color: ${primaryColor}; }
        .powered-by { font-size: 11px; color: #999; margin-top: 4px; }
        .period { font-size: 12px; color: #666; margin-top: 4px; }
        .gradient-line { height: 4px; background: linear-gradient(90deg, ${primaryColor}, #10b981); margin-bottom: 20px; }
        .content { padding: 0 40px 40px; }
        .section-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; margin-top: 25px; text-transform: uppercase; color: #444; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .summary-grid { display: flex; flex-wrap: wrap; gap: 16px; }
        .summary-item { border: 1px solid #eee; border-radius: 6px; padding: 10px 14px; min-width: 160px; background: #fafafa; }
        .summary-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .summary-value { font-size: 16px; font-weight: 700; color: ${primaryColor}; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { text-align: left; padding: 8px; background-color: #f9f9f9; border-bottom: 2px solid #ddd; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background-color: #fafafa; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .muted { color: #999; font-style: italic; }
        .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 50px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; font-size: 10px; color: #999; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-container">
          <img src="${logoUrl}" alt="Logo" />
          <div class="restaurant-name">${branding.restaurantName}</div>
        </div>
        <div class="header-right">
          <div class="report-title">${data.title}</div>
          <div class="powered-by">Powered by Dineiz</div>
          <div class="period">${data.period} &middot; Generated: ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <div class="gradient-line"></div>
      <div class="content">
        ${summaryHtml}
        ${tableHtml}
      </div>
      <div class="footer">
        <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        <div>${branding.restaurantName} &mdash; ${data.title}</div>
        <div>Powered by Dineiz &mdash; dineiz.com</div>
      </div>
    </body>
    </html>
  `;
}

const PDF_WORKER_URL = process.env.PDF_WORKER_URL || 'http://localhost:8091';

// Renders a real PDF via the pdf-worker microservice (Puppeteer) — no
// Cloudinary or any other cloud storage involved, just HTML in, PDF bytes out.
export async function generatePDF(data: ReportData, branding: Branding): Promise<Buffer> {
  const html = renderReportHtml(data, branding);

  const res = await fetch(`${PDF_WORKER_URL}/render-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });

  if (!res.ok) {
    throw new Error(`PDF generation failed: pdf-worker responded ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
