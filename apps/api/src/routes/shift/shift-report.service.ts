import { prisma } from '@swiftserve/db';
import ExcelJS from 'exceljs';

export async function getShiftReport(tenantId: string, shiftId: string, format: 'pdf' | 'excel') {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      user: true,
      branch: {
        include: { tenant: true }
      },
      cashEntries: true,
      denominations: true,
      breaks: true
    }
  });

  if (!shift) {
    return { buffer: null, contentType: '', filename: '' };
  }

  const isOpen = shift.status === 'OPEN';

  // Orders List (Moved up to use for payment aggregation)
  const orders = await prisma.order.findMany({
    where: { shiftId: shift.id, status: { notIn: ['CANCELLED'] } },
    include: {
      payments: { where: { status: 'COMPLETED' } },
      table: true,
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.netAmount, 0);

  let cashTotal = 0;
  let cardTotal = 0;
  let jazzCashTotal = 0;
  let easyPaisaTotal = 0;
  let cashOrders = 0;
  let cardOrders = 0;
  let jazzCashOrders = 0;
  let easyPaisaOrders = 0;

  orders.forEach(order => {
    order.payments.forEach(p => {
      if (p.method === 'CASH') { cashTotal += p.amount; cashOrders++; }
      else if (p.method === 'CARD') { cardTotal += p.amount; cardOrders++; }
      else if (p.method === 'JAZZCASH') { jazzCashTotal += p.amount; jazzCashOrders++; }
      else if (p.method === 'EASYPAISA') { easyPaisaTotal += p.amount; easyPaisaOrders++; }
    });
  });

  // Calculate Break Times
  let totalBreakSeconds = 0;
  shift.breaks.forEach(b => {
    const end = b.endedAt ? b.endedAt.getTime() : Date.now();
    totalBreakSeconds += Math.floor((end - b.startedAt.getTime()) / 1000);
  });
  
  const shiftEnd = shift.closedAt ? shift.closedAt.getTime() : Date.now();
  const shiftDurationSeconds = Math.floor((shiftEnd - shift.openedAt.getTime()) / 1000);
  const activeSeconds = Math.max(0, shiftDurationSeconds - totalBreakSeconds);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Cash Reconciliation
  const cashIn = shift.cashEntries.filter(e => e.type === 'CASH_IN').reduce((acc, e) => acc + e.amount, 0);
  const cashOut = shift.cashEntries.filter(e => e.type === 'CASH_OUT').reduce((acc, e) => acc + e.amount, 0);
  const expectedCash = shift.openingFloat + cashTotal + cashIn - cashOut;

  const actualCash = isOpen ? null : shift.closingCash;
  const variance = isOpen ? null : (shift.variance ?? (actualCash! - expectedCash));

  const tenant = shift.branch.tenant;
  const primaryColor = tenant.primaryColor || '#F59E0B';
  const logoUrl = tenant.logoUrl || 'https://dineiz.com/logo.png'; // Fallback

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `shift-report-${dateStr}-${shift.user.name.replace(/\s+/g, '-').toLowerCase()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Shift Summary');
    summarySheet.mergeCells('A1:D2');
    const headerCell = summarySheet.getCell('A1');
    headerCell.value = `${tenant.name} - ${shift.branch.name}\n${isOpen ? 'INTERIM SHIFT REPORT' : 'SHIFT REPORT'}`;
    headerCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor.replace('#', '') } };

    summarySheet.addRow([]);
    summarySheet.addRow(['Cashier', shift.user.name, 'Role', shift.user.role]);
    summarySheet.addRow(['Opened At', shift.openedAt.toLocaleString(), 'Closed At', isOpen ? 'Open' : shift.closedAt?.toLocaleString()]);
    summarySheet.addRow(['Duration', formatTime(shiftDurationSeconds), 'Opening Float', shift.openingFloat]);
    summarySheet.addRow(['Total Orders', totalOrders, 'Total Revenue', totalRevenue]);
    summarySheet.addRow(['Status', isOpen ? 'OPEN' : shift.status, 'Variance', variance !== null ? variance : 'N/A']);
    summarySheet.addRow([]);
    
    // Revenue Breakdown
    summarySheet.addRow(['Revenue Breakdown']).font = { bold: true, size: 14 };
    summarySheet.addRow(['Method', 'Orders', 'Amount', '% of Total']).font = { bold: true };
    const addRevRow = (method: string, count: number, amount: number) => {
      summarySheet.addRow([method, count, amount, totalRevenue > 0 ? (amount / totalRevenue) : 0]);
    };
    addRevRow('Cash', cashOrders, cashTotal);
    addRevRow('Card', cardOrders, cardTotal);
    addRevRow('JazzCash', jazzCashOrders, jazzCashTotal);
    addRevRow('EasyPaisa', easyPaisaOrders, easyPaisaTotal);
    summarySheet.addRow(['TOTAL', totalOrders, totalRevenue, 1]).font = { bold: true };
    
    summarySheet.addRow([]);
    // Reconciliation
    summarySheet.addRow(['Cash Reconciliation']).font = { bold: true, size: 14 };
    summarySheet.addRow(['Opening Float', shift.openingFloat]);
    summarySheet.addRow(['Cash Orders', cashTotal]);
    summarySheet.addRow(['Cash In', cashIn]);
    summarySheet.addRow(['Cash Out', cashOut]);
    summarySheet.addRow(['Expected in Drawer', expectedCash]).font = { bold: true };
    summarySheet.addRow(['Actual Counted', actualCash !== null ? actualCash : 'N/A (Shift Open)']);
    summarySheet.addRow(['Variance', variance !== null ? variance : 'N/A']).font = { bold: true };
    
    // Sheet 2: Orders
    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.mergeCells('A1:G1');
    const ordersHeader = ordersSheet.getCell('A1');
    ordersHeader.value = 'Orders During This Shift';
    ordersHeader.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    ordersHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor.replace('#', '') } };
    
    ordersSheet.columns = [
      { header: 'Order #', key: 'orderNumber', width: 10 },
      { header: 'Table', key: 'table', width: 10 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Items', key: 'items', width: 10 },
      { header: 'Method', key: 'method', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Time', key: 'time', width: 20 },
    ];
    ordersSheet.getRow(2).font = { bold: true };

    orders.forEach(o => {
      ordersSheet.addRow({
        orderNumber: `#${o.orderNumber}`,
        table: o.table?.label || '-',
        type: o.type,
        items: o._count.items,
        method: o.payments.map(p => p.method).join(', ') || '-',
        amount: o.netAmount,
        time: o.createdAt.toLocaleString()
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(excelBuffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename
    };
  }

  // PDF Generation HTML
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 0; }
        .header { display: flex; justify-content: space-between; padding: 20px 40px; height: 80px; align-items: center; }
        .logo-container img { max-height: 40px; }
        .restaurant-name { font-size: 18px; font-weight: bold; margin-top: 5px; }
        .branch-info { font-size: 12px; color: #666; }
        .header-right { text-align: right; }
        .report-title { font-size: 22px; font-weight: 700; color: ${primaryColor}; }
        .powered-by { font-size: 11px; color: #999; margin-top: 4px; }
        .gradient-line { height: 4px; background: linear-gradient(90deg, ${primaryColor}, #10b981); margin-bottom: 20px; }
        .content { padding: 0 40px; }
        .section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; margin-top: 25px; text-transform: uppercase; color: #444; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .grid-2 { display: flex; justify-content: space-between; }
        .grid-2 > div { width: 48%; }
        .info-row { font-size: 13px; margin-bottom: 6px; display: flex; justify-content: space-between;}
        .info-label { font-weight: 500; color: #666; }
        .info-val { font-weight: 600; }
        .large-val { font-size: 18px; color: ${primaryColor}; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th { text-align: left; padding: 8px; background-color: #f9f9f9; border-bottom: 2px solid #ddd; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background-color: #fafafa; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .text-green { color: #10b981; }
        .text-red { color: #ef4444; }
        .text-amber { color: #f59e0b; }
        .recon-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; background: #fafafa; width: 300px; }
        .notes-box { border: 1px solid #ddd; padding: 15px; border-radius: 4px; background: #fdfdfd; font-style: italic; }
        .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 50px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; font-size: 10px; color: #999; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-container">
          <img src="${logoUrl}" alt="Logo" />
          <div class="restaurant-name">${tenant.name}</div>
          <div class="branch-info">${shift.branch.name} ${shift.branch.phone ? '• ' + shift.branch.phone : ''}</div>
        </div>
        <div class="header-right">
          <div class="report-title">${isOpen ? 'INTERIM REPORT' : 'SHIFT REPORT'}</div>
          <div class="powered-by">Powered by Dineiz</div>
          <div class="branch-info" style="margin-top: 5px;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      </div>
      <div class="gradient-line"></div>
      
      <div class="content">
        ${isOpen ? '<div style="background: #fef3c7; color: #92400e; padding: 10px; border-radius: 4px; font-size: 12px; font-weight: bold; text-align: center; margin-bottom: 15px;">INTERIM REPORT - SHIFT IS STILL OPEN</div>' : ''}
        
        <div class="section-title">Shift Summary</div>
        <div class="grid-2">
          <div>
            <div class="info-row"><span class="info-label">Cashier:</span> <span class="info-val">${shift.user.name} (${shift.user.role})</span></div>
            <div class="info-row"><span class="info-label">Shift Opened:</span> <span class="info-val">${shift.openedAt.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Shift Closed:</span> <span class="info-val">${isOpen ? 'Open' : shift.closedAt?.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Duration:</span> <span class="info-val">${formatTime(shiftDurationSeconds)}</span></div>
            <div class="info-row"><span class="info-label">Terminal:</span> <span class="info-val">${shift.branch.name}</span></div>
          </div>
          <div>
            <div class="info-row"><span class="info-label">Opening Float:</span> <span class="info-val">PKR ${shift.openingFloat.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Total Orders:</span> <span class="info-val">${totalOrders}</span></div>
            <div class="info-row"><span class="info-label">Total Revenue:</span> <span class="large-val">PKR ${totalRevenue.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">Status:</span> <span class="info-val ${isOpen ? 'text-amber' : ''}">${shift.status}</span></div>
            <div class="info-row"><span class="info-label">Variance:</span> <span class="info-val ${variance === 0 ? 'text-green' : (variance !== null && variance < 0 ? 'text-red' : '')}">${variance !== null ? 'PKR ' + variance.toLocaleString() : 'N/A'}</span></div>
          </div>
        </div>

        <div class="section-title">Revenue Breakdown</div>
        <table>
          <thead>
            <tr><th>Payment Method</th><th>Orders</th><th class="text-right">Amount</th><th class="text-right">% of Total</th></tr>
          </thead>
          <tbody>
            <tr><td>Cash</td><td>${cashOrders}</td><td class="text-right">PKR ${cashTotal.toLocaleString()}</td><td class="text-right">${totalRevenue ? Math.round(cashTotal/totalRevenue*100) : 0}%</td></tr>
            <tr><td>Card</td><td>${cardOrders}</td><td class="text-right">PKR ${cardTotal.toLocaleString()}</td><td class="text-right">${totalRevenue ? Math.round(cardTotal/totalRevenue*100) : 0}%</td></tr>
            <tr><td>JazzCash</td><td>${jazzCashOrders}</td><td class="text-right">PKR ${jazzCashTotal.toLocaleString()}</td><td class="text-right">${totalRevenue ? Math.round(jazzCashTotal/totalRevenue*100) : 0}%</td></tr>
            <tr><td>EasyPaisa</td><td>${easyPaisaOrders}</td><td class="text-right">PKR ${easyPaisaTotal.toLocaleString()}</td><td class="text-right">${totalRevenue ? Math.round(easyPaisaTotal/totalRevenue*100) : 0}%</td></tr>
            <tr class="bold"><td>TOTAL</td><td>${totalOrders}</td><td class="text-right">PKR ${totalRevenue.toLocaleString()}</td><td class="text-right">100%</td></tr>
          </tbody>
        </table>

        <div class="section-title">Cash Reconciliation</div>
        <div class="recon-box">
          <div class="info-row"><span class="info-label">Opening Float:</span> <span>PKR ${shift.openingFloat.toLocaleString()}</span></div>
          <br/>
          <div class="info-row"><span class="info-label">Cash Orders:</span> <span>PKR ${cashTotal.toLocaleString()}</span></div>
          <div class="info-row"><span class="info-label">Cash In (Petty):</span> <span>PKR ${cashIn.toLocaleString()}</span></div>
          <div class="info-row"><span class="info-label">Cash Out (Petty):</span> <span>- PKR ${cashOut.toLocaleString()}</span></div>
          <div class="info-row bold" style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px;"><span class="info-label" style="color: #333;">Expected in Drawer:</span> <span>PKR ${expectedCash.toLocaleString()}</span></div>
          <br/>
          <div class="info-row"><span class="info-label">Actual Counted:</span> <span>${actualCash !== null ? 'PKR ' + actualCash.toLocaleString() : 'N/A (Shift Open)'}</span></div>
          <div class="info-row bold ${variance === 0 ? 'text-green' : (variance !== null && variance < 0 ? 'text-red' : '')}"><span class="info-label">VARIANCE:</span> <span>${variance !== null ? 'PKR ' + variance.toLocaleString() : 'N/A'}</span></div>
        </div>

        ${shift.denominations.length > 0 ? `
          <div style="margin-top: 15px; width: 300px;">
            <table style="margin-bottom: 0;">
              <thead><tr><th>Note</th><th>Count</th><th class="text-right">Total</th></tr></thead>
              <tbody>
                ${shift.denominations.map(d => `<tr><td>${d.denomination}</td><td>${d.count}</td><td class="text-right">PKR ${(d.denomination * d.count).toLocaleString()}</td></tr>`).join('')}
                <tr class="bold"><td>Total</td><td></td><td class="text-right">PKR ${shift.denominations.reduce((acc, d) => acc + (d.denomination * d.count), 0).toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="section-title" style="page-break-before: always;">Orders During This Shift</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order</th>
              <th>Table</th>
              <th>Type</th>
              <th>Items</th>
              <th>Method</th>
              <th class="text-right">Amount</th>
              <th class="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((o, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>#${o.orderNumber}</td>
                <td>${o.table?.label || '-'}</td>
                <td>${o.type}</td>
                <td>${o._count.items}</td>
                <td>${o.payments.map(p => p.method).join(', ') || '-'}</td>
                <td class="text-right">PKR ${o.netAmount.toLocaleString()}</td>
                <td class="text-right">${o.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
              </tr>
            `).join('')}
            <tr class="bold" style="border-top: 2px solid #ccc;">
              <td colspan="4">TOTALS</td>
              <td>${orders.reduce((acc, o) => acc + o._count.items, 0)} items</td>
              <td></td>
              <td class="text-right">PKR ${totalRevenue.toLocaleString()}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Notes</div>
        <div class="notes-box">
          ${shift.notes ? shift.notes : 'No notes recorded for this shift.'}
        </div>
        
      </div>
      
      <div class="footer">
        <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
        <div>${tenant.name} - ${shift.branch.name} - Shift ${shift.id.slice(-6).toUpperCase()}</div>
        <div>Powered by Dineiz &mdash; dineiz.com</div>
      </div>
    </body>
    </html>
  `;

  // Fetch from pdf-worker
  const pdfRes = await fetch('http://localhost:8091/render-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html })
  });

  if (!pdfRes.ok) {
    throw new Error('Failed to generate PDF');
  }

  const arrayBuffer = await pdfRes.arrayBuffer();
  
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: 'application/pdf',
    filename
  };
}
