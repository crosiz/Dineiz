'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCw } from 'lucide-react';

const TEMPLATE_OPTIONS = [
  'WELCOME',
  'TRIAL_REMINDER_7',
  'TRIAL_REMINDER_3',
  'TRIAL_REMINDER_1',
  'TRIAL_EXTENDED',
  'TRIAL_ENDED',
  'PAYMENT_RECEIVED',
  'RENEWAL_REMINDER',
  'PAYMENT_FAILED',
  'SUSPENSION_WARNING',
  'SUSPENDED',
  'REACTIVATED',
  'PLAN_CHANGED',
  'MANAGER_INVITE',
  'PASSWORD_RESET',
  'BRANCH_CREATED',
];

const STATUS_OPTIONS = ['QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED'];

interface EmailLogRow {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  recipientEmail: string;
  template: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
}

function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'QUEUED':
      return 'bg-slate-100 text-slate-600 border border-slate-200';
    case 'FAILED':
    case 'BOUNCED':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function EmailLogContent() {
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateFilter, setTemplateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Read the initial filter from the URL (e.g. the dashboard's "bounced emails"
  // deep link) without next/navigation's useSearchParams, which requires a
  // Suspense boundary that never resolved reliably for this page in dev.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    if (status) setStatusFilter(status);
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (templateFilter !== 'ALL') query.set('template', templateFilter);
    if (statusFilter !== 'ALL') query.set('status', statusFilter);

    fetch(`/api/system/email-log?${query.toString()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.logs) setLogs(d.logs);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFilter, statusFilter]);

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      const res = await fetch(`/api/system/email-log/${id}/resend`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Failed to resend email');
      } else {
        fetchLogs();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Log</h1>
          <p className="text-sm text-slate-500">Every transactional email sent to tenants, with resend for failed deliveries</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="ALL">All Templates</option>
          {TEMPLATE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="ALL">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <th className="py-3.5 px-4">Recipient</th>
              <th className="py-3.5 px-4">Tenant</th>
              <th className="py-3.5 px-4">Template</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Attempts</th>
              <th className="py-3.5 px-4">Sent / Created</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading email log...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400">No emails match this filter.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-700">{log.recipientEmail}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{log.tenantName || 'N/A'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                      {log.template.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={log.subject}>{log.subject}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClasses(log.status)}`}>
                      {log.status}
                    </span>
                    {log.errorMessage && (
                      <span className="block text-[10px] text-rose-500 mt-0.5 max-w-[200px] truncate" title={log.errorMessage}>
                        {log.errorMessage}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">{log.attempts}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(log.sentAt || log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {log.status === 'FAILED' ? (
                      <button
                        onClick={() => handleResend(log.id)}
                        disabled={resendingId === log.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-semibold disabled:opacity-50"
                      >
                        <RotateCw className={`w-3 h-3 ${resendingId === log.id ? 'animate-spin' : ''}`} />
                        <span>Resend</span>
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EmailLogPage() {
  return <EmailLogContent />;
}
