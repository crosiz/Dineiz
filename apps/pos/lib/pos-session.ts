export interface PosSession {
  userId: string;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  tenantId: string;
  avatarColor: string;
  token: string;
  expiresAt: string;
}

export interface PosShift {
  shiftId: string;
  openedAt: string;
  openingFloat: number;
}

export const getPosSession = (): PosSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('pos_session') ?? 'null');
  } catch {
    return null;
  }
};

export const getPosShift = (): PosShift | null => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('pos_shift') ?? 'null');
  } catch {
    return null;
  }
};

// Signing out ends the login session only — it does not close the shift.
// The Sign Out confirmation dialog (POSTopBar.tsx) tells the cashier
// exactly that ("your shift will remain active for when you return"), but
// this used to remove 'pos_shift' too, so logging back in found no local
// shift record and got sent through Shift Open again even though the
// shift was still open on the server. A shift is only ever meant to be
// cleared by actually closing it (see CloseShiftModal.tsx, which clears it
// explicitly as part of a successful close).
export const clearPosSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('pos_session');
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_branding');
  localStorage.removeItem('pos_assigned_tables');
};

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('pos_token');
  if (token) return token;
  const session = getPosSession();
  return session?.token || null;
};

export interface PosBreak {
  breakId: string;
  shiftId: string;
  startedAt: string; // ISO timestamp
}

export const getPosBreak = (): PosBreak | null => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('pos_break') ?? 'null');
  } catch {
    return null;
  }
};

export const setPosBreak = (data: PosBreak): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pos_break', JSON.stringify(data));
};

export const clearPosBreak = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('pos_break');
};
