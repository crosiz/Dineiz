'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── A horizontally scrolling strip you can actually reach the end of ────────
//
// The category rail was an `overflow-x-auto no-scrollbar` div. On a phone that
// is fine — you swipe. On a counter terminal with a mouse it is not: there is
// no scrollbar to drag (no-scrollbar hides it), no arrows, and a plain wheel
// does nothing to a horizontal overflow. With eleven categories on a 1280px
// screen, 568px of the rail — 44% of it, everything from Pizza onward — was
// simply unreachable.
//
// This keeps the swipe behaviour and adds what a pointer needs: arrows that
// appear only when there IS more in that direction, a wheel that scrolls the
// strip, and a fade that marks the cut edge. Nothing appears when everything
// already fits.

export function ScrollRail({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack: sub-pixel layout means scrollLeft rarely equals max exactly.
    setAtEnd(max <= 1 || el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Children changing (a branch's categories loading) changes scrollWidth
    // without resizing the element.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [measure]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    // Most of a screenful, not all of it — leaving a chip visible from the
    // previous page is what tells you the strip moved rather than jumped.
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  // A vertical wheel over a horizontal strip should move the strip; otherwise
  // the page scrolls behind it and the rail looks stuck.
  const onWheel = (e: React.WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
  };

  const arrow =
    // Pointer affordance only. On a touch screen you swipe, and a button
    // floating over the strip would both cover a chip and fight the swipe.
    'absolute top-1/2 -translate-y-1/2 z-30 hidden sm:grid place-items-center w-8 h-8 rounded-full ' +
    'bg-surface border border-line shadow-sm text-ink-2 hover:text-ink hover:bg-sunken transition-colors';

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        onScroll={measure}
        onWheel={onWheel}
        role="group"
        aria-label={ariaLabel}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {children}
      </div>

      {!atStart && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-surface to-transparent pointer-events-none z-20" />
          <button type="button" onClick={() => nudge(-1)} aria-label="Scroll left" className={`${arrow} left-1`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </>
      )}
      {!atEnd && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-surface to-transparent pointer-events-none z-20" />
          <button type="button" onClick={() => nudge(1)} aria-label="Scroll right" className={`${arrow} right-1`}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
