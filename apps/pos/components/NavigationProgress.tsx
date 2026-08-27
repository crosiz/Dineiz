'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useNavProgress } from '@/lib/nav-progress-store';

const MIN_VISIBLE_MS = 420; // stay up long enough to be perceived on a fast (local) screen switch

/**
 * The one loading indicator shown during a screen change — a 3px bar pinned to
 * the very top of the terminal that trickles while the next screen loads, then
 * snaps to 100% and fades. Replaces the per-screen "Loading…" spinners.
 *
 * Detection without touching every nav call: Next runs every client navigation
 * through `history.pushState` / `replaceState` (and `popstate`). We wrap those
 * once to fire `start()`; the resulting `pathname` / `searchParams` change ends
 * it. The bottom nav also calls `start()` directly on tap.
 */
export function NavigationProgress() {
  const active = useNavProgress((s) => s.active);
  const start = useNavProgress((s) => s.start);
  const done = useNavProgress((s) => s.done);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const visibleRef = useRef(false);
  const shownAtRef = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // ── Wrap history so any screen change lights the bar ──────────────────────
  useEffect(() => {
    const wrap = (key: 'pushState' | 'replaceState') => {
      const original = history[key];
      if ((original as any).__navProgressWrapped) return () => {};
      const wrapped = function (this: History, ...args: Parameters<History['pushState']>) {
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
      try {
        history[key] = wrapped;
      } catch {
        /* non-writable — the bottom nav's direct start() call still covers taps */
      }
      return () => {
        try { history[key] = original; } catch { /* ignore */ }
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

  // ── Screen settled → finish ─────────────────────────────────────────────
  useEffect(() => {
    done();
  }, [pathname, searchParams, done]);

  // ── React to active flips ──────────────────────────────────────────────
  useEffect(() => {
    const clearTrickle = () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      trickleRef.current = null;
    };

    if (active) {
      if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
      if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }
      if (!visibleRef.current) shownAtRef.current = Date.now();
      setVisible(true);
      setProgress((p) => (p > 0 && p < 90 ? p : 12));

      if (!reducedMotion) {
        clearTrickle();
        trickleRef.current = setInterval(() => {
          setProgress((p) => {
            if (p >= 90) return p;
            const step = p < 40 ? 10 : p < 65 ? 4 : p < 80 ? 2 : 0.6;
            return Math.min(90, p + step);
          });
        }, 200);
      } else {
        setProgress(80);
      }

      safetyRef.current = setTimeout(() => done(), 8000);
    } else {
      clearTrickle();
      if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
      if (!visibleRef.current) return;

      const finish = () => {
        setProgress(100);
        hideRef.current = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 260);
      };
      const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAtRef.current));
      if (wait === 0) finish();
      else hideRef.current = setTimeout(finish, wait);
    }

    return clearTrickle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion, done]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[100] h-[3px] pointer-events-none"
      style={{ opacity: progress >= 100 ? 0 : 1, transition: 'opacity 220ms ease 100ms' }}
    >
      <div
        className="relative h-full origin-left"
        style={{
          width: `${progress}%`,
          background: 'var(--pos-primary, #F59E0B)',
          boxShadow:
            '0 0 10px color-mix(in srgb, var(--pos-primary, #F59E0B) 75%, transparent), 0 0 3px var(--pos-primary, #F59E0B)',
          transition: reducedMotion
            ? 'width 120ms linear'
            : 'width 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="absolute right-0 top-0 h-full w-24"
          style={{
            transform: 'rotate(2deg) translateY(-1px)',
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--pos-primary, #F59E0B) 90%, white))',
            boxShadow: '0 0 14px var(--pos-primary, #F59E0B)',
            opacity: reducedMotion ? 0 : 0.9,
          }}
        />
      </div>
    </div>
  );
}
