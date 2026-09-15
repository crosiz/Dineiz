// ─── View Mode (spec Part 11) ────────────────────────────────────────────
//
// SHIFT MODE  — a shift is open. Full ordering, cash is tracked.
// VIEW MODE   — signed in, no shift. Read-only + non-financial actions:
//               view today's orders, reprint, table map, mark clean/reserved,
//               stock levels, shift reports, assign waiters. Cannot create an
//               order, add items, or take a payment.
//
// Only reachable when the console setting `allowLoginWithoutShift` is on and
// the cashier explicitly chose "Continue Without Shift" on the shift-open
// screen (which sets `pos_view_mode`).

export function allowsViewMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const b = JSON.parse(localStorage.getItem('pos_branding') ?? '{}');
    const p = { ...(b.pos ?? {}), ...b };
    return !!p.allowLoginWithoutShift;
  } catch {
    return false;
  }
}

export function isViewMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('pos_view_mode') !== '1') return false;
    const shift = JSON.parse(localStorage.getItem('pos_shift') ?? 'null');
    return !shift?.shiftId; // a real shift always wins
  } catch {
    return false;
  }
}

export function enterViewMode(): void {
  try { localStorage.setItem('pos_view_mode', '1'); } catch { /* ignore */ }
}

export function exitViewMode(): void {
  try { localStorage.removeItem('pos_view_mode'); } catch { /* ignore */ }
}
