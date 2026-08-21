// Shared display constants for the Wastage Log screen — kept separate so the
// modal, history table, and analytics charts all agree on labels/colors.

export const REASON_LABELS: Record<string, string> = {
  EXPIRED: 'Expired',
  SPOILED: 'Spoiled',
  DROPPED: 'Dropped',
  OVER_PREP: 'Over-Prep',
  PEST_DAMAGE: 'Pest Damage',
  POWER_OUTAGE: 'Power Outage',
  QUALITY_REJECT: 'Quality Reject',
  OTHER: 'Other',
};

export function humanizeReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

// One color per reason (8 reasons) — also used for the "by reason" pie chart
// so legend swatches and table chips line up.
export const REASON_COLORS: Record<string, string> = {
  EXPIRED: '#ff5722',
  SPOILED: '#8b5cf6',
  DROPPED: '#3b82f6',
  OVER_PREP: '#f59e0b',
  PEST_DAMAGE: '#10b981',
  POWER_OUTAGE: '#06b6d4',
  QUALITY_REJECT: '#ec4899',
  OTHER: '#64748b',
};

export const CHART_COLORS = ['#ff5722', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

// ─── Manager-PIN gate for large wastage ────────────────────────────────────
// There is no backend PIN-verification endpoint to call from the dashboard,
// and the backend does not enforce a PIN gate on the wastage-create route
// either. Rather than fake a network call, we show a visible warning above
// this threshold and still allow submission — blocking client-side only
// would be inconsistent with what's actually enforced server-side.
export const MANAGER_PIN_REVIEW_THRESHOLD = 5000; // PKR
