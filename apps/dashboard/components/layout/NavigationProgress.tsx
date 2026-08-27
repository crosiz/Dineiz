'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useNavProgress } from '@/lib/nav-progress-store';

/**
 * The one and only loading indicator shown during navigation — a 2px bar that
 * pins to the very top of the viewport, trickles forward while the next route's
 * JS and first data load, then snaps to 100% and fades. Replaces the ~20
 * per-screen spinners that each sat at a different offset.
 *
 * How a navigation is detected without touching every <Link>/router.push call:
 * Next performs all client navigations through `history.pushState` /
 * `replaceState` (and `popstate` for back/forward). We wrap those once to fire
 * `start()`, and end on the resulting `pathname` / `searchParams` change.
 */
export function NavigationProgress() {
  const active = useNavProgress((s) => s.active);
  const start = useNavProgress((s) => s.start);
  const done = useNavProgress((s) => s.done);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // ── Wrap history so any client navigation lights the bar ──────────────────
  useEffect(() => {
    const wrap = (key: 'pushState' | 'replaceState') => {
      const original = history[key];
      // Guard against double-wrapping across fast refresh / remounts.
      if ((original as any).__navProgressWrapped) return () => {};
      const wrapped = function (this: History, ...args: Parameters<History['pushState']>) {
        // Only light the bar when the URL actually changes — a same-page
        // pushState (e.g. re-clicking the current tab) must not leave it stuck.
        try {
          const target = new URL(String(args[2] ?? ''), window.location.href);
          const cur = window.location;
          if (args[2] != null && target.pathname + target.search !== cur.pathname + cur.search) {
            start();
          }
        } catch {
          if (args[2] != null) start();
        }
        return original.apply(this, args as any);
      } as History['pushState'];
      (wrapped as any).__navProgressWrapped = true;
      history[key] = wrapped;
      return () => {
        history[key] = original;
      };
    };

    const unpush = wrap('pushState');
    const unreplace = wrap('replaceState');
    const onPop = () => start();
    window.addEventListener('popstate', onPop);

    return () => {
      unpush();
      unreplace();
      window.removeEventListener('popstate', onPop);
    };
  }, [start]);

  // ── Route settled → finish ───────────────────────────────────────────────
  useEffect(() => {
    done();
    // pathname / searchParams are the deps that matter; values themselves unused
  }, [pathname, searchParams, done]);

  // ── React to active flips ────────────────────────────────────────────────
  useEffect(() => {
    const clearTrickle = () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      trickleRef.current = null;
    };

    if (active) {
      if (safetyRef.current) clearTimeout(safetyRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      setVisible(true);
      setProgress((p) => (p > 0 && p < 90 ? p : 8));

      if (!reducedMotion) {
        clearTrickle();
        trickleRef.current = setInterval(() => {
          setProgress((p) => {
            if (p >= 90) return p;
            // Ease off as it approaches the cap so it never visually stalls.
            const step = p < 40 ? 9 : p < 65 ? 4 : p < 80 ? 2 : 0.6;
            return Math.min(90, p + step);
          });
        }, 240);
      } else {
        setProgress(80);
      }

      // Never let a hung navigation leave the bar stuck.
      safetyRef.current = setTimeout(() => done(), 8000);
    } else {
      clearTrickle();
      if (safetyRef.current) clearTimeout(safetyRef.current);
      if (!visible) return;
      setProgress(100);
      hideRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 280);
    }

    return clearTrickle;
    // `visible` intentionally omitted — including it would restart the trickle
    // on the same navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion, done]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[1000] h-[2.5px] pointer-events-none"
      style={{ opacity: progress >= 100 ? 0 : 1, transition: 'opacity 240ms ease 120ms' }}
    >
      <div
        className="relative h-full origin-left"
        style={{
          width: `${progress}%`,
          background: 'var(--color-primary, #FF5722)',
          boxShadow:
            '0 0 8px color-mix(in srgb, var(--color-primary, #FF5722) 70%, transparent), 0 0 2px var(--color-primary, #FF5722)',
          transition: reducedMotion
            ? 'width 120ms linear'
            : 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* leading glow ("peg") */}
        <div
          className="absolute right-0 top-0 h-full w-24"
          style={{
            transform: 'rotate(2deg) translateY(-1px)',
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary, #FF5722) 90%, white))',
            boxShadow: '0 0 12px var(--color-primary, #FF5722)',
            opacity: reducedMotion ? 0 : 0.9,
          }}
        />
      </div>
    </div>
  );
}
