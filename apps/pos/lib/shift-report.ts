import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Fetches a shift report and hands the file to the browser.
 *
 * The POS authenticates with a Bearer token held in localStorage, not a
 * cookie — so `window.open('/api/shifts/x/report')` and `<a href>` both come
 * back 401 with nothing downloaded. (That is exactly what the close-shift
 * screen used to do: the buttons appeared to work and silently produced an
 * error page.) The token has to travel on the request, which means fetching
 * the bytes and saving them ourselves.
 *
 * `token` can be passed explicitly for the close-shift flow, which clears the
 * POS session as part of closing and would otherwise have nothing left to
 * authenticate the download with.
 */
export async function downloadShiftReport(
  shiftId: string,
  format: 'pdf' | 'excel' = 'pdf',
  token?: string | null,
): Promise<{ blob: Blob; filename: string; url: string }> {
  const auth = token ?? getToken();
  if (!auth) throw new Error('Not signed in — cannot download the shift report.');

  const res = await fetch(`${API_URL}/api/shifts/${shiftId}/report?format=${format}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Report failed (${res.status})`);
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : `shift-report.${format === 'excel' ? 'xlsx' : 'pdf'}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  return { blob, filename, url };
}

/**
 * Opens the report in a new tab for printing.
 *
 * Shares the authenticated fetch above rather than pointing a tab at the API
 * URL directly. The object URL is revoked on a delay because revoking it
 * immediately can race the new tab's own load.
 */
export async function printShiftReport(shiftId: string, token?: string | null): Promise<void> {
  const auth = token ?? getToken();
  if (!auth) throw new Error('Not signed in — cannot open the shift report.');

  const res = await fetch(`${API_URL}/api/shifts/${shiftId}/report?format=pdf`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Report failed (${res.status})`);
  }

  const url = URL.createObjectURL(await res.blob());
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Your browser blocked the print window. Allow pop-ups and try again.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
