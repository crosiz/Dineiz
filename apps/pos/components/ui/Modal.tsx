'use client';

import { useEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  label?: string;
  sheetOnMobile?: boolean;
  zIndex?: number;
}

const openDialogs: HTMLElement[] = [];
let originalOverflow = '';
const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/** A viewport-safe, keyboard-accessible shell, including nested dialogs. */
export function Modal({ isOpen, onClose, children, className = '', labelledBy, label = 'Dialog', sheetOnMobile = false, zIndex = 200 }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!isOpen || !mounted || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousDialog = openDialogs[openDialogs.length - 1];
    const previousLayer = Number(previousDialog?.parentElement?.style.zIndex || 0);
    if (dialog.parentElement) dialog.parentElement.style.zIndex = String(Math.max(zIndex, previousLayer + 10));
    const previous = document.activeElement as HTMLElement | null;
    if (openDialogs.length === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.push(dialog);
    // Avoid summoning the phone keyboard just by opening a dialog.
    dialog.focus();
    const onKey = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault(); event.stopImmediatePropagation(); closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (openDialogs[openDialogs.length - 1] === dialog && !dialog.contains(event.target as Node)) dialog.focus();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const index = openDialogs.indexOf(dialog);
      if (index >= 0) openDialogs.splice(index, 1);
      if (!openDialogs.length) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen, mounted]);
  if (!isOpen || !mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 flex justify-center ${sheetOnMobile ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-3 sm:p-4'}`} style={{ zIndex }}>
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/45" onClick={() => { if (openDialogs[openDialogs.length - 1] === dialogRef.current) onClose?.(); }} />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}
        className={`pos-dialog relative flex w-full max-h-[calc(100dvh-2rem)] flex-col overflow-hidden border border-line bg-surface shadow-xl outline-none ${sheetOnMobile ? 'rounded-t-2xl sm:rounded-2xl' : 'rounded-2xl'} ${className}`}>
        {children}
      </section>
    </div>, document.body,
  ) as unknown as ReactElement;
}
