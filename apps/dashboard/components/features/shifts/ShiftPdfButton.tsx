'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiDownload } from '@/lib/api-client';

/**
 * Downloads the full shift report for one shift.
 *
 * The report endpoint is Bearer-authenticated, so this can't be a plain link —
 * see apiDownload. Generating the PDF renders a headless page server-side and
 * takes a beat, hence the explicit pending state rather than a silent click.
 */
export function ShiftPdfButton({
  shiftId,
  format = 'pdf',
  variant = 'icon',
  label,
  className = '',
}: {
  shiftId: string;
  format?: 'pdf' | 'excel';
  variant?: 'icon' | 'button';
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading(format === 'pdf' ? 'Generating shift report…' : 'Building spreadsheet…');
    try {
      const filename = await apiDownload(`/api/shifts/${shiftId}/report`, { format }, `shift-report.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      toast.success(`Saved ${filename}`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate the report', { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={download}
        disabled={busy}
        title="Download shift report (PDF)"
        aria-label="Download shift report as PDF"
        className={`p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors ${className}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors ${className}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {label ?? (format === 'pdf' ? 'Download PDF' : 'Download Excel')}
    </button>
  );
}
