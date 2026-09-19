'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Dialog, DialogButton } from '@/components/ui/Dialog';
import { PinPad } from '@/components/ui/PinPad';
import { getPosSession, clearPosSession } from '@/lib/pos-session';
import { useCartStore } from '@/lib/store';
import { renewSession, useSessionGuard } from '@/lib/session-guard';

// Asks for the signed-in person's PIN when the server session has lapsed
// (lib/session-guard.ts), over whatever screen they are on. The screen stays
// as it was: the cart, an open dialog, a half-counted drawer. Only the token
// changes.
export function SessionExpiredDialog() {
  const expired = useSessionGuard((s) => s.expired);
  const cartEmpty = useCartStore((s) => s.cart.length === 0);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'muted' } | null>(null);
  const [offline, setOffline] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    if (!expired) { setPin(''); setMessage(null); setOffline(false); }
  }, [expired]);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  if (!expired) return null;
  const session = getPosSession();
  if (!session) return null;

  const submit = async (value: string) => {
    setChecking(true);
    setMessage(null);
    const result = await renewSession(value);
    setChecking(false);
    setPin('');
    if (result.ok) return;
    if (result.reason === 'wrong-pin') {
      const left = result.attemptsLeft;
      setMessage({ text: typeof left === 'number' && left <= 2 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong PIN. Try again.', tone: 'error' });
    } else if (result.reason === 'locked') {
      setLockedFor(result.retryAfter);
      setMessage(null);
    } else if (result.reason === 'offline') {
      setOffline(true);
      setMessage({ text: 'No connection to the server. Keep working; this will ask again once it is back.', tone: 'muted' });
    } else {
      setMessage({ text: 'Couldn’t sign you back in. Sign out and sign in again.', tone: 'error' });
    }
  };

  const signOut = () => {
    clearPosSession();
    useCartStore.getState().clearSession();
    window.location.href = '/login';
  };

  // Offline, there is nothing to renew against. Close for now; the next 401
  // (which can only come once the server is reachable) opens this again.
  const keepWorking = () => useSessionGuard.setState({ expired: false });

  return (
    <Dialog
      onClose={() => {}}
      dismissible={false}
      z={400}
      icon={KeyRound}
      tone="brand"
      title="Enter your PIN to continue"
      description={
        <>
          {session.name ? <>{session.name}, your</> : 'Your'} sign-in has timed out. Nothing on screen is lost, and anything
          waiting to sync goes as soon as you are back in.
        </>
      }
      footer={cartEmpty || offline ? (
        <>
          {cartEmpty && <DialogButton onClick={signOut}>Sign out</DialogButton>}
          {offline && <DialogButton variant="ink" onClick={keepWorking}>Keep working offline</DialogButton>}
        </>
      ) : undefined}
    >
      <PinPad
        value={pin}
        onChange={(v) => { setPin(v); if (v && message?.tone === 'error') setMessage(null); }}
        onComplete={submit}
        error={message?.tone === 'error'}
        disabled={checking || lockedFor > 0}
      />
      <p className={`mt-3 min-h-5 text-center text-[13px] font-medium ${message?.tone === 'error' || lockedFor > 0 ? 'text-danger' : 'text-ink-3'}`}>
        {lockedFor > 0 ? `Too many wrong PINs. Try again in ${lockedFor}s.` : checking ? 'Checking…' : message?.text ?? ''}
      </p>
    </Dialog>
  );
}
