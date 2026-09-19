import type { ReactNode } from 'react';
import { ServiceIllustration, type IllustrationKind } from '@/components/ServiceIllustration';

// A whole screen that says one thing: a drawing, a headline, one sentence, and
// the way out. Used where the app has nothing else to show (a missing page, a
// crash), so staff are never left on a browser's technical error page.
export function StatusScreen({
  drawing, title, children, actions,
}: {
  drawing: IllustrationKind;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="min-h-dvh w-full bg-canvas grid place-items-center p-4">
      <div className="w-full max-w-[420px] flex flex-col items-center text-center">
        <ServiceIllustration kind={drawing} className="w-48 h-[154px] mb-4" />
        <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{children}</p>
        <div className="mt-6 w-full flex flex-col sm:flex-row gap-2.5 justify-center">{actions}</div>
      </div>
    </main>
  );
}

export const statusButton = {
  primary: 'h-11 px-5 rounded-xl bg-brand text-on-brand text-[14px] font-semibold hover:bg-brand-strong inline-flex items-center justify-center',
  secondary: 'h-11 px-5 rounded-xl bg-surface border border-line-strong text-ink text-[14px] font-semibold hover:bg-sunken inline-flex items-center justify-center',
};
