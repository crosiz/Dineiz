'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCartStore } from '@/lib/store';

// Registers public/sw.js (see scripts/sw.template.js) and rolls out new builds.
//
// A new build's worker installs in the background and then waits. Swapping it
// in means reloading the page, so that only happens at a moment when a reload
// costs nothing: the screen is hidden, or the terminal is sitting on a resting
// screen with an empty cart. Nothing is lost either way (queued orders live in
// IndexedDB), but a cashier should never have the screen reload under them
// mid-order.

const RESTING = new Set(['/login', '/pos', '/pos/home']);
const UPDATE_CHECK_MS = 15 * 60 * 1000;

export function ServiceWorkerRegistrar() {
  const pathname = usePathname();
  const cartEmpty = useCartStore((s) => s.cart.length === 0);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const safeRef = useRef(false);
  safeRef.current = RESTING.has(pathname ?? '') && cartEmpty;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Dev never registers a worker, and removes any left by a production
      // build served on this origin earlier: a cached shell would otherwise
      // hide every code change behind a stale copy.
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      return;
    }

    let reloading = false;
    const onControllerChange = () => {
      // Only a swap this component asked for triggers a reload. The very first
      // install also changes the controller (clients.claim) and must not.
      if (reloading || !sessionStorage.getItem('sw-updating')) return;
      reloading = true;
      sessionStorage.removeItem('sw-updating');
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        regRef.current = reg;
        // An update that finishes installing while the terminal is already at
        // rest would otherwise wait for the next navigation.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && safeRef.current) applyUpdate(reg);
          });
        });
      })
      .catch((err) => console.warn('[sw] registration failed', err));

    const check = () => regRef.current?.update().catch(() => {});
    const interval = setInterval(check, UPDATE_CHECK_MS);
    window.addEventListener('online', check);

    const onHidden = () => {
      if (document.visibilityState === 'hidden') applyUpdate(regRef.current);
    };
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      clearInterval(interval);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

  // Each time the terminal comes to rest, take a waiting update if there is one.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (safeRef.current) applyUpdate(regRef.current);
  }, [pathname, cartEmpty]);

  return null;
}

function applyUpdate(reg: ServiceWorkerRegistration | null) {
  const waiting = reg?.waiting;
  if (!waiting || !navigator.serviceWorker.controller) return;
  try {
    sessionStorage.setItem('sw-updating', '1');
  } catch {
    return; // no way to tell the reload apart from a first install; wait for a cold start
  }
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
