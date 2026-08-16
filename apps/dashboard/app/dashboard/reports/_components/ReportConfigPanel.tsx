'use client';
import React, { useState, useEffect } from 'react';
import { ReportType } from '../page';
import { Calendar, Building2, FileType, Clock, Users, Phone, Loader2, Download, Eye, Send } from 'lucide-react';
import { apiPost } from '@/lib/api-client';
import { API_URL } from '@/lib/api';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranches } from '@/hooks/useBranches';

type ReportColumn = { key: string; label: string; align?: 'left' | 'right' };
type ReportData = {
  title: string;
  period: string;
  summary?: { label: string; value: string | number }[];
  columns?: ReportColumn[];
  rows?: Record<string, any>[];
  totals?: Record<string, string | number>;
};

function fmt(v: any) {
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return v ?? '-';
}

function ReportDataTable({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-bold text-slate-800">{data.title}</h4>
        <p className="text-xs text-slate-500">{data.period}</p>
      </div>

      {data.summary && data.summary.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.summary.map((s, i) => (
            <div key={i} className="border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 min-w-[150px]">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">{s.label}</div>
              <div className="text-base font-bold text-indigo-700 mt-0.5">{fmt(s.value)}</div>
            </div>
          ))}
        </div>
      )}

      {data.columns && data.columns.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {data.columns.map(c => (
                  <th key={c.key} className={`px-3 py-2 font-semibold text-slate-600 text-xs uppercase ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).length === 0 ? (
                <tr><td colSpan={data.columns.length} className="px-3 py-6 text-center text-slate-400 text-sm">No data available for this period.</td></tr>
              ) : data.rows!.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {data.columns!.map(c => (
                    <td key={c.key} className={`px-3 py-2 text-slate-700 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{fmt(row[c.key])}</td>
                  ))}
                </tr>
              ))}
              {data.totals && (
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  {data.columns.map((c, i) => (
                    <td key={c.key} className={`px-3 py-2 text-slate-800 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.key in data.totals! ? fmt(data.totals![c.key]) : (i === 0 ? 'TOTAL' : '')}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!data.summary?.length && !data.columns?.length && (
        <p className="text-sm text-slate-400 italic">No data available for this period.</p>
      )}
    </div>
  );
}

export function ReportConfigPanel({ type }: { type: ReportType }) {
  const { selectedBranchId } = useDashboardContext();
  const { data: branches = [] } = useBranches();

  // Basic Config
  const [dateRange, setDateRange] = useState('TODAY'); // TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, CUSTOM
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [branch, setBranch] = useState(selectedBranchId || 'ALL');
  const [format, setFormat] = useState<'PDF' | 'EXCEL' | 'CSV'>('PDF');

  // Schedule Config
  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [runTime, setRunTime] = useState('09:00');
  const [recipients, setRecipients] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // UI State
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<ReportData | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Revoke blob URLs on unmount / when a new preview replaces the old one
  useEffect(() => {
    return () => { if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); };
  }, [previewPdfUrl]);

  const getTitle = () => {
    switch (type) {
      case 'TAX_REPORT': return 'Tax Report (FBR/GST)';
      case 'SHIFT_BALANCE': return 'Shift Balance Report';
      default: return type.replace(/_/g, ' ');
    }
  };

  const getDesc = () => {
    switch (type) {
      case 'TAX_REPORT': return 'Generates a compliant tax summary showing gross, taxable, and non-taxable revenue along with cash/card tax collections.';
      case 'SHIFT_BALANCE': return 'Detailed breakdown of all shifts in the period, identifying expected cash vs actual cash entered to detect variances.';
      default: return 'Configure and generate this report.';
    }
  };

  const calculateDates = () => {
    const today = new Date();
    let s = new Date();
    let e = new Date();

    if (dateRange === 'TODAY') {
      s = today; e = today;
    } else if (dateRange === 'YESTERDAY') {
      s.setDate(today.getDate() - 1); e = new Date(s);
    } else if (dateRange === 'THIS_WEEK') {
      s.setDate(today.getDate() - today.getDay()); e = today;
    } else if (dateRange === 'THIS_MONTH') {
      s.setDate(1); e = today;
    } else {
      s = new Date(startDate);
      e = new Date(endDate);
    }

    return { startDate: s.toISOString(), endDate: e.toISOString() };
  };

  const handlePreview = async () => {
    setLoading(true);
    setPreviewData(null);
    if (previewPdfUrl) { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }

    try {
      const dates = calculateDates();
      const parameters = { startDate: dates.startDate, endDate: dates.endDate };

      if (format === 'PDF') {
        // Real rendered preview — an actual PDF, shown inline. No cloud storage.
        const res = await fetch(`${API_URL}/api/reports/preview/pdf`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportType: type, parameters }),
        });
        if (!res.ok) throw new Error('Failed to render preview');
        const blob = await res.blob();
        setPreviewPdfUrl(URL.createObjectURL(blob));
      } else {
        const res = await apiPost('/api/reports/preview', { reportType: type, parameters }) as any;
        setPreviewData(res.data);
      }
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const dates = calculateDates();
      const res = await fetch(`${API_URL}/api/reports/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: type,
          reportName: getTitle(),
          format,
          parameters: { startDate: dates.startDate, endDate: dates.endDate },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to generate report' }));
        throw new Error(err.message || 'Failed to generate report');
      }
      const blob = await res.blob();
      const ext = format === 'PDF' ? 'pdf' : format === 'EXCEL' ? 'xlsx' : 'csv';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${getTitle().replace(/ /g, '_')}.${ext}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      alert(err.message);
    }
    setGenerating(false);
  };

  const handleSchedule = async () => {
    if (!recipients && !whatsapp) {
      alert('Please provide at least one recipient email or WhatsApp number.');
      return;
    }

    setLoading(true);
    try {
      const emails = recipients.split(',').map(e => e.trim()).filter(Boolean);
      await apiPost('/api/reports/scheduled', {
        name: `${getTitle()} - Auto`,
        reportType: type,
        format,
        frequency,
        runAtTime: runTime,
        parameters: { dynamicDate: dateRange }, // Store logical range, e.g. "YESTERDAY" for daily reports
        recipients: emails,
        whatsappNumber: whatsapp
      });
      alert('Report scheduled successfully!');
      setIsScheduled(false);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{getTitle()}</h2>
        <p className="text-slate-500 mt-2">{getDesc()}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
            <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">1</span>
            Report Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Calendar size={14}/> Date Range</label>
              <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none">
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Range...</option>
              </select>
              {dateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                  <span className="text-slate-400">to</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Building2 size={14}/> Branch</label>
              <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium outline-none">
                <option value="ALL">All Branches</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">2</span>
            Output Format
          </h3>
          <div className="flex items-center gap-4">
            {['PDF', 'EXCEL', 'CSV'].map(fmtOpt => (
              <label key={fmtOpt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${format === fmtOpt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="format" value={fmtOpt} checked={format === fmtOpt} onChange={() => setFormat(fmtOpt as any)} className="hidden" />
                <FileType size={18} />
                <span className="font-bold text-sm">{fmtOpt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="p-6 bg-white flex items-center justify-between">
          <button
            onClick={() => setIsScheduled(!isScheduled)}
            className={`text-sm font-semibold flex items-center gap-2 transition-colors ${isScheduled ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Clock size={16} />
            {isScheduled ? 'Cancel Scheduling' : 'Automate this Report...'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={loading || generating}
              className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Preview
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || generating}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Generate & Download
            </button>
          </div>
        </div>
      </div>

      {isScheduled && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 shadow-sm animate-in slide-in-from-top-4 fade-in">
          <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
            <Send size={18} /> Schedule Delivery
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-indigo-800">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium outline-none">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-indigo-800">Time of Day</label>
              <input type="time" value={runTime} onChange={e => setRunTime(e.target.value)} className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5"><Users size={14}/> Email Recipients</label>
              <input type="text" placeholder="john@example.com, accounting@..." value={recipients} onChange={e => setRecipients(e.target.value)} className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5"><Phone size={14}/> WhatsApp (Optional)</label>
              <input type="text" placeholder="+923001234567" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={handleSchedule} disabled={loading} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/30">
              Save Schedule
            </button>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {previewPdfUrl && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 overflow-hidden">
          <h3 className="font-bold text-slate-800 mb-3 px-2">Preview</h3>
          <iframe src={previewPdfUrl} className="w-full h-[700px] rounded-xl border border-slate-200" title="Report preview" />
        </div>
      )}
      {previewData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden">
          <ReportDataTable data={previewData} />
        </div>
      )}
    </div>
  );
}
