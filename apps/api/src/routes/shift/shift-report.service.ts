import ExcelJS from 'exceljs';
import { buildShiftReportData, type ShiftReportData } from './shift-report.data';

const PDF_WORKER_URL = process.env.PDF_WORKER_URL || 'http://localhost:8091';

// ─── Formatting ───────────────────────────────────────────────────────────────

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `PKR ${Math.round(n).toLocaleString('en-US')}`;

const signedMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const r = Math.round(n);
  if (r === 0) return 'PKR 0';
  return `${r > 0 ? '+' : '−'}PKR ${Math.abs(r).toLocaleString('en-US')}`;
};

const duration = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/**
 * Reports are read in the restaurant's own timezone, not the server's.
 *
 * A malformed value in Branch.timezone would otherwise throw a RangeError out
 * of Intl and fail the whole download — a bad string in one branch row is not
 * a good reason for nobody to get their end-of-day report.
 */
function makeTimeFormatters(rawTimezone: string) {
  let timezone = rawTimezone;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    console.warn(`[shift-report] invalid timezone ${JSON.stringify(rawTimezone)}, falling back to Asia/Karachi`);
    timezone = 'Asia/Karachi';
  }

  const dateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const timeOnly = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const dateOnly = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, day: '2-digit', month: 'short', year: 'numeric',
  });
  return {
    dt: (d: Date | null | undefined) => (d ? dateTime.format(d) : '—'),
    t: (d: Date | null | undefined) => (d ? timeOnly.format(d) : '—'),
    d: (d: Date | null | undefined) => (d ? dateOnly.format(d) : '—'),
  };
}

/** HTML-escapes user-supplied text so a note containing markup can't break the page. */
const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ACTIVITY_LABEL: Record<string, string> = {
  OPENED: 'Shift opened',
  BREAK_START: 'Break started',
  BREAK_END: 'Break ended',
  CASH_IN: 'Cash in',
  CASH_OUT: 'Cash out',
  ORDER_COMPLETED: 'Order completed',
  ORDER_VOIDED: 'Void',
  DISCOUNT_APPLIED: 'Discount',
  CLOSED: 'Shift closed',
  FORCE_CLOSED: 'Force closed',
  FORCE_CLOSED_BY_MANAGER: 'Force closed by manager',
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

function renderHtml(data: ShiftReportData): string {
  const { shift, tenant, branch, isOpen, orders, activities, waiterStats, totals, paymentBreakdown, unsettled, refunds, time, cash, cancelledOrders } = data;
  const fmt = makeTimeFormatters(branch.timezone || 'Asia/Karachi');
  // Tenant stores its brand colour as `colorPrimary` — the old report read a
  // non-existent `primaryColor`, so every PDF silently fell back to the default.
  const accent = tenant.colorPrimary || '#0F172A';

  const row = (label: string, value: string, opts: { strong?: boolean; tone?: 'pos' | 'neg' } = {}) => `
    <div class="row${opts.strong ? ' row-strong' : ''}">
      <span class="row-label">${esc(label)}</span>
      <span class="row-value${opts.tone ? ' tone-' + opts.tone : ''}">${value}</span>
    </div>`;

  // `flow: true` is for the two sections that can legitimately run to
  // several pages (Orders, Activity Log) — everything else is short enough
  // to guarantee fits on one page, so it stays a single atomic block (see
  // `.block { break-inside: avoid-page }` below) rather than risking a
  // table splitting after its heading and one row, stranding the rest on
  // the next page with a ragged gap behind it.
  const section = (title: string, body: string, opts: { break?: boolean; flow?: boolean } = {}) =>
    body ? `<section class="block${opts.break ? ' page-break' : ''}${opts.flow ? ' flow' : ''}"><h2>${esc(title)}</h2>${body}</section>` : '';

  const varianceTone = cash.variance === null || Math.round(cash.variance) === 0
    ? undefined
    : cash.variance > 0 ? 'pos' : 'neg';

  // ── Payments ───────────────────────────────────────────────────────────────
  const share = (amount: number) => (totals.totalRevenue > 0 ? Math.round((amount / totals.totalRevenue) * 100) : 0);
  const paymentsTable = paymentBreakdown.length || unsettled.amount > 0
    ? `<table>
        <thead><tr><th>Payment method</th><th class="num">Payments</th><th class="num">Amount</th><th class="num">Share</th></tr></thead>
        <tbody>
          ${paymentBreakdown.map((p) => `<tr>
            <td>${esc(p.method)}</td>
            <td class="num">${p.orders}</td>
            <td class="num">${money(p.amount)}</td>
            <td class="num">${share(p.amount)}%</td>
          </tr>`).join('')}
          ${unsettled.amount > 0 ? `<tr>
            <td class="tone-warn">Unsettled — no payment recorded</td>
            <td class="num tone-warn">${unsettled.orders}</td>
            <td class="num tone-warn">${money(unsettled.amount)}</td>
            <td class="num tone-warn">${share(unsettled.amount)}%</td>
          </tr>` : ''}
          <tr class="total-row"><td>Total</td><td class="num">${totals.totalOrders}</td><td class="num">${money(totals.totalRevenue)}</td><td class="num">100%</td></tr>
        </tbody>
      </table>`
    : '<p class="empty">No payments recorded on this shift.</p>';

  // ── Cash movements ─────────────────────────────────────────────────────────
  const cashEntriesTable = shift.cashEntries.length
    ? `<table>
        <thead><tr><th>Time</th><th>Type</th><th>Reason</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${shift.cashEntries.map((e) => `<tr>
            <td>${fmt.t(e.createdAt)}</td>
            <td>${e.type === 'CASH_IN' ? 'Cash in' : 'Cash out'}</td>
            <td>${esc(e.reason || '—')}</td>
            <td class="num${e.type === 'CASH_OUT' ? ' tone-neg' : ''}">${e.type === 'CASH_OUT' ? '−' : '+'}${money(e.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '';

  // ── Denominations ──────────────────────────────────────────────────────────
  const denominationsTable = shift.denominations.length
    ? `<table class="narrow">
        <thead><tr><th>Note / coin</th><th class="num">Count</th><th class="num">Value</th></tr></thead>
        <tbody>
          ${shift.denominations.map((d) => `<tr>
            <td>${money(d.denomination)}</td>
            <td class="num">${d.quantity}</td>
            <td class="num">${money(d.denomination * d.quantity)}</td>
          </tr>`).join('')}
          <tr class="total-row"><td>Counted total</td><td class="num"></td><td class="num">${money(cash.countedFromDenominations)}</td></tr>
        </tbody>
      </table>`
    : '';

  // ── Breaks ─────────────────────────────────────────────────────────────────
  const breaksTable = shift.breaks.length
    ? `<table>
        <thead><tr><th>#</th><th>Started</th><th>Ended</th><th class="num">Duration</th><th>Reason</th></tr></thead>
        <tbody>
          ${shift.breaks.map((b, i) => `<tr>
            <td>${i + 1}</td>
            <td>${fmt.t(b.startedAt)}</td>
            <td>${b.endedAt ? fmt.t(b.endedAt) : '<span class="tone-warn">Still on break</span>'}</td>
            <td class="num">${b.durationMinutes != null ? b.durationMinutes + 'm' : duration(Math.floor((Date.now() - b.startedAt.getTime()) / 1000))}</td>
            <td>${esc(b.reason || '—')}</td>
          </tr>`).join('')}
          <tr class="total-row"><td colspan="3">Total break time</td><td class="num">${duration(time.totalBreakSeconds)}</td><td></td></tr>
        </tbody>
      </table>`
    : '<p class="empty">No breaks were taken on this shift.</p>';

  // ── Orders ─────────────────────────────────────────────────────────────────
  const ordersTable = orders.length
    ? `<table>
        <thead><tr><th class="num">#</th><th>Order</th><th>Table</th><th>Type</th><th class="num">Items</th><th>Payment</th><th class="num">Discount</th><th class="num">Net</th><th class="num">Time</th></tr></thead>
        <tbody>
          ${orders.map((o, i) => `<tr>
            <td class="num">${i + 1}</td>
            <td>#${esc(o.orderNumber)}</td>
            <td>${esc(o.table?.label || '—')}</td>
            <td>${esc(String(o.type).replace(/_/g, ' '))}</td>
            <td class="num">${o._count.items}</td>
            <td>${esc(o.payments.map((p) => p.method).join(', ') || '—')}</td>
            <td class="num">${o.discountAmount ? money(o.discountAmount) : '—'}</td>
            <td class="num">${money(o.netAmount)}</td>
            <td class="num">${fmt.t(o.createdAt)}</td>
          </tr>`).join('')}
          <tr class="total-row">
            <td colspan="4">Totals</td>
            <td class="num">${orders.reduce((a, o) => a + o._count.items, 0)}</td>
            <td></td>
            <td class="num">${money(totals.totalDiscount)}</td>
            <td class="num">${money(totals.totalRevenue)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>`
    : '<p class="empty">No orders were rung up on this shift.</p>';

  // ── Staff performance ──────────────────────────────────────────────────────
  const waiterTable = waiterStats.length
    ? `<table class="narrow">
        <thead><tr><th>Server</th><th class="num">Orders</th><th class="num">Revenue</th></tr></thead>
        <tbody>
          ${[...waiterStats].sort((a, b) => (b._sum.netAmount ?? 0) - (a._sum.netAmount ?? 0)).map((w) => `<tr>
            <td>${esc(w.assignedWaiterName || 'Unassigned')}</td>
            <td class="num">${w._count.id}</td>
            <td class="num">${money(w._sum.netAmount ?? 0)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '';

  // ── Timeline ───────────────────────────────────────────────────────────────
  // ORDER_COMPLETED is excluded here on purpose: it duplicates the Orders
  // table row-for-row (same order #, amount, method, time), and on a busy
  // shift it's the overwhelming majority of activity rows — 65 orders meant
  // 65 near-identical "Order completed" lines burying the handful of entries
  // that actually need a manager's attention (a cash-out, a break, a void).
  // The full record — including every ORDER_COMPLETED — still exists in the
  // shift's activity feed on the dashboard and in the Excel export, where
  // page count isn't a cost; this is specifically the printed page.
  const printedActivities = activities.filter((a) => a.activityType !== 'ORDER_COMPLETED');
  const timelineTable = printedActivities.length
    ? `<table>
        <thead><tr><th class="col-time">Time</th><th class="col-event">Event</th><th>Detail</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${printedActivities.map((a) => `<tr>
            <td class="col-time">${fmt.t(a.occurredAt)}</td>
            <td class="col-event">${esc(ACTIVITY_LABEL[a.activityType] ?? a.activityType)}</td>
            <td>${esc(a.notes || '—')}</td>
            <td class="num">${a.amount != null ? money(a.amount) : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty">No notable activity — every event on this shift was a routine order (see Orders above).</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Shift report</title>
<style>
  @page { margin: 16mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #0F172A; margin: 0; font-size: 10.5px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .masthead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid ${accent}; }
  .masthead .brand-name { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .masthead .brand-sub { font-size: 10px; color: #64748B; margin-top: 2px; }
  .masthead img { max-height: 34px; max-width: 150px; margin-bottom: 6px; display: block; }
  .masthead .doc { text-align: right; }
  .masthead .doc-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; }
  .masthead .doc-meta { font-size: 9.5px; color: #64748B; margin-top: 3px; }

  .banner { margin-top: 14px; padding: 8px 12px; border: 1px solid #FCD34D; background: #FFFBEB; color: #92400E; font-size: 10px; font-weight: 600; border-radius: 4px; }
  .banner-alert { border-color: #FCA5A5; background: #FEF2F2; color: #991B1B; }

  h2 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; color: #475569; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #E2E8F0; }
  /* Every section is short enough to fit on one page, so it moves as a whole
     rather than splitting after its heading and a row or two — that's what
     produced a ragged "gap, then the rest on the next page" for Cash
     Movements on a page that only had room for one row of it. Sections that
     can genuinely run to multiple pages (.flow: Orders, Activity Log) opt
     back out, since forcing THEM to be atomic would just move a multi-page
     table wholesale instead of splitting it cleanly between rows. */
  .block { margin-top: 20px; break-inside: avoid-page; page-break-inside: avoid; }
  .block.flow { break-inside: auto; page-break-inside: auto; }
  .page-break { page-break-before: always; }
  /* A heading is never left alone at the bottom of a page with its content
     pushed to the next — the two always move together. */
  h2 { break-after: avoid-page; page-break-after: avoid; }

  .cols { display: flex; gap: 28px; }
  .cols > * { flex: 1; min-width: 0; }

  .row { display: flex; justify-content: space-between; gap: 12px; padding: 3.5px 0; }
  .row-label { color: #64748B; }
  .row-value { font-weight: 600; text-align: right; white-space: nowrap; }
  .row-strong { border-top: 1px solid #CBD5E1; margin-top: 5px; padding-top: 7px; }
  .row-strong .row-label { color: #0F172A; font-weight: 700; }
  .row-strong .row-value { font-weight: 700; }
  .tone-pos { color: #047857; }
  .tone-neg { color: #B91C1C; }
  .tone-warn { color: #B45309; }

  .kpis { display: flex; gap: 10px; margin-top: 16px; }
  .kpi { flex: 1; border: 1px solid #E2E8F0; border-radius: 5px; padding: 9px 11px; }
  .kpi-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.07em; color: #64748B; font-weight: 600; }
  .kpi-value { font-size: 15px; font-weight: 700; margin-top: 3px; letter-spacing: -0.02em; }
  .kpi-note { font-size: 8.5px; color: #94A3B8; margin-top: 1px; }

  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.narrow { width: 62%; }
  th { text-align: left; font-weight: 600; color: #475569; padding: 6px 8px; border-bottom: 1px solid #CBD5E1; background: #F8FAFC; text-transform: uppercase; font-size: 8.5px; letter-spacing: 0.05em; }
  td { padding: 5.5px 8px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th.num { text-align: right; }
  .total-row td { font-weight: 700; border-top: 1px solid #CBD5E1; border-bottom: none; background: #F8FAFC; }
  .col-time { width: 58px; white-space: nowrap; }
  .col-event { width: 108px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  .note-box { border: 1px solid #E2E8F0; border-radius: 5px; padding: 10px 12px; color: #334155; background: #F8FAFC; }
  .empty { color: #94A3B8; font-style: italic; padding: 4px 0; }
  .colophon { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E2E8F0; font-size: 8.5px; color: #94A3B8; display: flex; justify-content: space-between; }
</style>
</head>
<body>

  <div class="masthead">
    <div>
      ${/* A tenant logo that 404s would otherwise print a broken-image glyph
            in the corner of every report. */ ''}
      ${tenant.logoUrl ? `<img src="${esc(tenant.logoUrl)}" alt="" onerror="this.remove()" />` : ''}
      <div class="brand-name">${esc(tenant.name)}</div>
      <div class="brand-sub">${esc(branch.name)}${branch.phone ? ' · ' + esc(branch.phone) : ''}</div>
    </div>
    <div class="doc">
      <div class="doc-title">${isOpen ? 'Interim shift report' : 'Shift report'}</div>
      <div class="doc-meta">Shift ${esc(shift.id.slice(-6).toUpperCase())} · ${fmt.d(shift.openedAt)}</div>
      <div class="doc-meta">Generated ${fmt.dt(new Date())}</div>
    </div>
  </div>

  ${isOpen ? '<div class="banner">This shift is still open. Figures are a live snapshot and will change until the shift is closed.</div>' : ''}
  ${shift.closedReason ? `<div class="banner banner-alert">Force-closed by a manager — ${esc(shift.closedReason)}</div>` : ''}
  ${shift.status === 'ABANDONED' ? '<div class="banner banner-alert">This shift was auto-marked as abandoned after a long period of inactivity. Cash was never counted.</div>' : ''}

  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Net sales</div><div class="kpi-value">${money(totals.totalRevenue)}</div><div class="kpi-note">${totals.totalOrders} order${totals.totalOrders === 1 ? '' : 's'}</div></div>
    <div class="kpi"><div class="kpi-label">Expected cash</div><div class="kpi-value">${money(cash.expectedCash)}</div><div class="kpi-note">incl. ${money(cash.openingFloat)} float</div></div>
    <div class="kpi"><div class="kpi-label">Counted</div><div class="kpi-value">${money(cash.actualCash)}</div><div class="kpi-note">${isOpen ? 'not yet counted' : 'cashier count'}</div></div>
    <div class="kpi"><div class="kpi-label">Variance</div><div class="kpi-value${varianceTone ? ' tone-' + varianceTone : ''}">${signedMoney(cash.variance)}</div><div class="kpi-note">${cash.variance === null ? '—' : Math.round(cash.variance) === 0 ? 'balanced' : cash.variance > 0 ? 'over' : 'short'}</div></div>
  </div>

  ${section('Shift details', `
    <div class="cols">
      <div>
        ${row('Cashier', esc(shift.user.name))}
        ${row('Role', esc(String(shift.user.role).replace(/_/g, ' ')))}
        ${row('Branch', esc(branch.name))}
        ${row('Opened', fmt.dt(shift.openedAt))}
        ${row('Closed', isOpen ? 'Still open' : fmt.dt(shift.closedAt))}
        ${row('Opened via', esc(shift.method || 'MANUAL'))}
      </div>
      <div>
        ${row('Total duration', duration(time.shiftDurationSeconds))}
        ${row('Break time', `${duration(time.totalBreakSeconds)} (${shift.breaks.length})`)}
        ${row('Active time', duration(time.activeSeconds), { strong: true })}
        ${row('Status', esc(shift.closedReason ? 'FORCE CLOSED' : shift.status))}
        ${row('Cancelled orders', String(cancelledOrders))}
      </div>
    </div>`)}

  ${section('Sales summary', `
    <div class="cols">
      <div>
        ${row('Gross sales', money(totals.grossSales))}
        ${row('Discounts', totals.totalDiscount > 0 ? '−' + money(totals.totalDiscount) : money(0))}
        ${row('Tax collected', money(totals.totalTax))}
        ${row('Net sales', money(totals.totalRevenue), { strong: true })}
      </div>
      <div>
        ${row('Orders', String(totals.totalOrders))}
        ${row('Average order value', money(totals.avgOrderValue))}
        ${row('Orders per active hour', time.activeSeconds > 0 ? (totals.totalOrders / (time.activeSeconds / 3600)).toFixed(1) : '—')}
        ${row('Refunds', refunds.count > 0 ? `−${money(refunds.amount)} (${refunds.count})` : money(0), refunds.count > 0 ? { tone: 'neg' } : {})}
      </div>
    </div>`)}

  ${section('Payment breakdown', paymentsTable)}

  ${section('Cash reconciliation', `
    <div class="cols">
      <div>
        ${row('Opening float', money(cash.openingFloat))}
        ${row('Cash sales', money(cash.cashTotal))}
        ${row('Cash in', cash.cashIn > 0 ? '+' + money(cash.cashIn) : money(0))}
        ${row('Cash out', cash.cashOut > 0 ? '−' + money(cash.cashOut) : money(0))}
        ${row('Expected in drawer', money(cash.expectedCash), { strong: true })}
      </div>
      <div>
        ${row('Counted by cashier', money(cash.actualCash))}
        ${shift.denominations.length ? row('Denomination total', money(cash.countedFromDenominations)) : ''}
        ${row('Variance', signedMoney(cash.variance), { strong: true, tone: varianceTone })}
      </div>
    </div>
    ${denominationsTable ? `<div style="margin-top:14px">${denominationsTable}</div>` : ''}`)}

  ${cashEntriesTable ? section('Cash movements', cashEntriesTable) : ''}

  ${section('Breaks', breaksTable)}

  ${waiterTable ? section('Server performance', waiterTable) : ''}

  ${section('Orders', ordersTable, { break: true, flow: true })}

  ${section('Activity Log', timelineTable, { break: true, flow: true })}

  ${section('Notes', `<div class="note-box">${shift.notes ? esc(shift.notes) : 'No notes were recorded for this shift.'}</div>`)}

  <div class="colophon">
    <span>${esc(tenant.name)} · ${esc(branch.name)} · Shift ${esc(shift.id.slice(-6).toUpperCase())}</span>
    <span>Generated ${fmt.dt(new Date())}</span>
  </div>

</body>
</html>`;
}

// ─── Excel ────────────────────────────────────────────────────────────────────

async function renderExcel(data: ShiftReportData): Promise<Buffer> {
  const { shift, tenant, branch, isOpen, orders, activities, totals, paymentBreakdown, unsettled, time, cash } = data;
  const fmt = makeTimeFormatters(branch.timezone || 'Asia/Karachi');
  const accentArgb = 'FF' + (tenant.colorPrimary || '#0F172A').replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = tenant.name;
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 26 }, { width: 24 }, { width: 22 }, { width: 18 }];

  summary.mergeCells('A1:D2');
  const header = summary.getCell('A1');
  header.value = `${tenant.name} — ${branch.name}\n${isOpen ? 'INTERIM SHIFT REPORT' : 'SHIFT REPORT'}`;
  header.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentArgb } };

  const heading = (label: string) => {
    summary.addRow([]);
    summary.addRow([label]).font = { bold: true, size: 12 };
  };

  heading('Shift details');
  summary.addRow(['Shift', shift.id.slice(-6).toUpperCase(), 'Status', shift.closedReason ? 'FORCE CLOSED' : shift.status]);
  summary.addRow(['Cashier', shift.user.name, 'Role', String(shift.user.role).replace(/_/g, ' ')]);
  summary.addRow(['Opened', fmt.dt(shift.openedAt), 'Closed', isOpen ? 'Still open' : fmt.dt(shift.closedAt)]);
  summary.addRow(['Total duration', duration(time.shiftDurationSeconds), 'Active time', duration(time.activeSeconds)]);
  summary.addRow(['Break time', duration(time.totalBreakSeconds), 'Breaks taken', shift.breaks.length]);

  heading('Sales summary');
  summary.addRow(['Gross sales', totals.grossSales]);
  summary.addRow(['Discounts', -totals.totalDiscount]);
  summary.addRow(['Tax collected', totals.totalTax]);
  summary.addRow(['Net sales', totals.totalRevenue]).font = { bold: true };
  summary.addRow(['Orders', totals.totalOrders]);
  summary.addRow(['Average order value', totals.avgOrderValue]);

  heading('Payment breakdown');
  summary.addRow(['Method', 'Payments', 'Amount', 'Share']).font = { bold: true };
  for (const p of paymentBreakdown) {
    summary.addRow([p.method, p.orders, p.amount, totals.totalRevenue > 0 ? p.amount / totals.totalRevenue : 0]);
  }
  if (unsettled.amount > 0) {
    summary.addRow(['Unsettled — no payment recorded', unsettled.orders, unsettled.amount, totals.totalRevenue > 0 ? unsettled.amount / totals.totalRevenue : 0]);
  }
  summary.addRow(['TOTAL', totals.totalOrders, totals.totalRevenue, 1]).font = { bold: true };

  heading('Cash reconciliation');
  summary.addRow(['Opening float', cash.openingFloat]);
  summary.addRow(['Cash sales', cash.cashTotal]);
  summary.addRow(['Cash in', cash.cashIn]);
  summary.addRow(['Cash out', -cash.cashOut]);
  summary.addRow(['Expected in drawer', cash.expectedCash]).font = { bold: true };
  summary.addRow(['Counted by cashier', cash.actualCash ?? 'Not counted (shift open)']);
  summary.addRow(['Variance', cash.variance ?? 'N/A']).font = { bold: true };

  if (shift.denominations.length) {
    heading('Denominations');
    summary.addRow(['Note / coin', 'Count', 'Value']).font = { bold: true };
    for (const d of shift.denominations) summary.addRow([d.denomination, d.quantity, d.denomination * d.quantity]);
    summary.addRow(['Counted total', '', cash.countedFromDenominations]).font = { bold: true };
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  const ordersSheet = workbook.addWorksheet('Orders');
  ordersSheet.columns = [
    { header: 'Order #', key: 'orderNumber', width: 12 },
    { header: 'Table', key: 'table', width: 10 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Items', key: 'items', width: 8 },
    { header: 'Payment', key: 'method', width: 18 },
    { header: 'Gross', key: 'gross', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Tax', key: 'tax', width: 12 },
    { header: 'Net', key: 'net', width: 12 },
    { header: 'Time', key: 'time', width: 22 },
  ];
  ordersSheet.getRow(1).font = { bold: true };
  for (const o of orders) {
    ordersSheet.addRow({
      orderNumber: `#${o.orderNumber}`,
      table: o.table?.label || '—',
      type: String(o.type).replace(/_/g, ' '),
      items: o._count.items,
      method: o.payments.map((p) => p.method).join(', ') || '—',
      gross: o.totalAmount,
      discount: o.discountAmount ?? 0,
      tax: o.taxAmount ?? 0,
      net: o.netAmount,
      time: fmt.dt(o.createdAt),
    });
  }

  // ── Breaks ─────────────────────────────────────────────────────────────────
  const breaksSheet = workbook.addWorksheet('Breaks');
  breaksSheet.columns = [
    { header: 'Started', key: 'start', width: 24 },
    { header: 'Ended', key: 'end', width: 24 },
    { header: 'Minutes', key: 'mins', width: 10 },
    { header: 'Reason', key: 'reason', width: 34 },
  ];
  breaksSheet.getRow(1).font = { bold: true };
  for (const b of shift.breaks) {
    breaksSheet.addRow({
      start: fmt.dt(b.startedAt),
      end: b.endedAt ? fmt.dt(b.endedAt) : 'Still on break',
      mins: b.durationMinutes ?? '',
      reason: b.reason || '—',
    });
  }

  // ── Activity log ───────────────────────────────────────────────────────────
  const activitySheet = workbook.addWorksheet('Activity log');
  activitySheet.columns = [
    { header: 'Time', key: 'time', width: 24 },
    { header: 'Event', key: 'event', width: 24 },
    { header: 'Detail', key: 'detail', width: 64 },
    { header: 'Amount', key: 'amount', width: 14 },
  ];
  activitySheet.getRow(1).font = { bold: true };
  for (const a of activities) {
    activitySheet.addRow({
      time: fmt.dt(a.occurredAt),
      event: ACTIVITY_LABEL[a.activityType] ?? a.activityType,
      detail: a.notes ?? '',
      amount: a.amount ?? '',
    });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function getShiftReport(tenantId: string, shiftId: string, format: 'pdf' | 'excel') {
  const data = await buildShiftReportData(tenantId, shiftId);
  if (!data) return { buffer: null, contentType: '', filename: '' };

  const { shift, branch } = data;
  const fmt = makeTimeFormatters(branch.timezone || 'Asia/Karachi');
  // Named for the shift it describes, not the day it was downloaded — two
  // copies of the same shift pulled a week apart should share a filename,
  // and a folder of them should sort by shift date.
  const datePart = fmt.d(shift.openedAt).replace(/\s/g, '-');
  const who = shift.user.name.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const filename = `shift-${datePart}-${who}-${shift.id.slice(-6).toUpperCase()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

  if (format === 'excel') {
    return {
      buffer: await renderExcel(data),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename,
    };
  }

  // A connection refused here throws a bare "fetch failed", which tells whoever
  // clicked Download nothing at all. Name the service and the URL instead —
  // the pdf-worker not being up is by far the most common cause.
  let pdfRes: Response;
  try {
    pdfRes = await fetch(`${PDF_WORKER_URL}/render-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: renderHtml(data) }),
    });
  } catch (err: any) {
    throw new Error(
      `Could not reach the PDF service at ${PDF_WORKER_URL}. Start it with \`pnpm --filter @dineiz/pdf-worker dev\` (or bring up the pdf-worker container). Underlying error: ${err?.message ?? err}`,
    );
  }

  if (!pdfRes.ok) {
    const detail = await pdfRes.text().catch(() => '');
    throw new Error(`PDF service at ${PDF_WORKER_URL} returned ${pdfRes.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
  }

  return {
    buffer: Buffer.from(await pdfRes.arrayBuffer()),
    contentType: 'application/pdf',
    filename,
  };
}
