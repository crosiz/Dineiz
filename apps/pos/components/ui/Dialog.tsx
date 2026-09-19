'use client';

import { useId, type ReactNode } from 'react';
import { Modal } from './Modal';
import { X, type LucideIcon } from 'lucide-react';

// The one modal shell. Every dialog in the POS was hand-rolled — each with its
// own overlay darkness, corner radius (rounded-2xl, rounded-[28px]…), title
// size (text-base to text-[26px]), button height (40 to 56px) and z-index —
// and several relied on `animate-in zoom-in-95`, classes from a Tailwind
// plugin this app doesn't have, so they did nothing. This keeps them one
// family: same frame, same type scale, same footer, same motion.
//
// Layout: header (icon, title, description, close) and footer stay put; only
// the body scrolls, and the whole panel is capped to the viewport so nothing
// is ever pushed off-screen on a landscape tablet.

type Tone = 'neutral' | 'brand' | 'danger' | 'warn' | 'ok' | 'info';

const TONE: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  brand: 'bg-brand/10 text-brand',
  danger: 'bg-danger/10 text-danger',
  warn: 'bg-warn/15 text-warn',
  ok: 'bg-ok/10 text-ok',
  info: 'bg-info/10 text-info',
};

const SIZE = { sm: 'max-w-[400px]', md: 'max-w-[480px]', lg: 'max-w-[600px]' } as const;

export function Dialog({
  open = true,
  onClose,
  title,
  description,
  icon: Icon,
  tone = 'neutral',
  size = 'sm',
  z = 300,
  footer,
  children,
  dismissible = true,
  labelledBy,
}: {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  size?: keyof typeof SIZE;
  /** Stacking level. A dialog opened from another dialog passes a higher one. */
  z?: number;
  footer?: ReactNode;
  children?: ReactNode;
  /** false for flows that must be finished or explicitly cancelled. */
  dismissible?: boolean;
  labelledBy?: string;
}) {
  const generatedId = useId();
  const titleId = labelledBy || generatedId;
  return (
    <Modal isOpen={open} onClose={dismissible ? onClose : undefined} labelledBy={titleId} zIndex={z} className={SIZE[size]}>
        <header className="px-6 pt-5 pb-4 flex items-start gap-3.5 shrink-0">
          {Icon && (
            <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${TONE[tone]}`}>
              <Icon className="w-5 h-5" strokeWidth={2.1} />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-[17px] font-semibold text-ink leading-snug">{title}</h2>
            {description && <div className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{description}</div>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 w-11 h-11 grid place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink shrink-0"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          )}
        </header>

        {children && <div className="px-6 pb-5 overflow-y-auto min-h-0 flex-1">{children}</div>}

        {footer && <footer className="px-6 py-4 border-t border-line flex items-center gap-2.5 shrink-0">{footer}</footer>}
    </Modal>
  );
}

/** Footer button. `grow` makes a pair share the width evenly. */
export function DialogButton({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  busy,
  grow = true,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ink';
  disabled?: boolean;
  busy?: boolean;
  grow?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-brand text-on-brand hover:bg-brand-strong',
    ink: 'bg-ink text-white hover:bg-ink-2',
    danger: 'bg-danger text-white hover:opacity-90',
    secondary: 'bg-surface border border-line-strong text-ink hover:bg-sunken',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`h-11 px-4 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${grow ? 'flex-1' : ''} ${styles}`}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}
