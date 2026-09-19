'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';

/** Same order content, with the shared focus/scroll-safe sheet on small screens. */
export function OrderPanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!wide) return <Modal isOpen={open} onClose={onClose} label="Current order" sheetOnMobile className="h-[85dvh] max-w-xl">{children}</Modal>;
  return <section aria-label="Current order" className="relative hidden min-h-0 w-[max(360px,var(--cart-width))] shrink-0 flex-col overflow-hidden bg-surface lg:flex">{children}</section>;
}
