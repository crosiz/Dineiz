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

export const setPosShift = (data: PosShift): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('pos_shift', JSON.stringify(data));
};

/**
 * The authoritative current shift, reconciled against the server.
 *
 * `pos_shift` in localStorage is written once when a shift opens and is
 * otherwise trusted forever — but a shift can end without the terminal doing
 * anything: the inactivity sweeper auto-marks a shift ABANDONED after ~20
 * hours open. When that happens, every action that trusted the stale id
 * (break start/end, cash drawer entries, close) hit the server's `status:
 * OPEN` guard, got a 404, and — because those call sites wrapped the request
 * in a bare try/catch — failed completely silently: the cashier's screen
 * still locked for their break, but no ShiftBreak row was ever created.
 *
 * Call this before any shift-scoped write. It asks the server what's
 * actually open, self-heals localStorage if a newer shift has replaced the
 * stale one, and clears it if nothing is open at all — so a stale record
 * degrades to "no shift" (a state every caller already has to handle)
 * instead of "wrong shift" (which silently corrupts a different shift's
 * data). Falls back to the local value on a network error rather than
 * blocking the action on connectivity that may be entirely unrelated.
 */
export async function resolveActiveShiftId(apiUrl: string): Promise<string | null> {
  const local = getPosShift();
  const token = getToken();
  if (!token) return local?.shiftId ?? null;

  try {
    const res = await fetch(`${apiUrl}/api/shifts/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return local?.shiftId ?? null;

    const data = await res.json();
    if (!data?.id) {
      localStorage.removeItem('pos_shift');
      return null;
    }
    if (data.id !== local?.shiftId) {
      setPosShift({ shiftId: data.id, openedAt: data.openedAt, openingFloat: data.openingFloat });
    }
    return data.id;
  } catch {
    return local?.shiftId ?? null;
  }
}

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
