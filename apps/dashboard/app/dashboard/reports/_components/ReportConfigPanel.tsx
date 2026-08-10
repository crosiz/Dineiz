'use client';
import React, { useState } from 'react';
import { ReportType } from '../page';
import { Calendar, Building2, FileType, Clock, Users, Phone, Loader2, Download, Eye, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranches } from '@/hooks/useBranches';

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
  const [previewData, setPreviewData] = useState<any>(null);

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
    try {
      const dates = calculateDates();
      const res = await apiPost('/api/reports/preview', {
        reportType: type,
        parameters: { startDate: dates.startDate, endDate: dates.endDate }
      }) as any;
      setPreviewData(res.data);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const dates = calculateDates();
      const res = await apiPost('/api/reports/generate', {
        reportType: type,
        reportName: getTitle(),
        format,
        parameters: { startDate: dates.startDate, endDate: dates.endDate }
      }) as any;
      
      if (res.fileUrl) {
        window.open(res.fileUrl, '_blank');
      } else if (res.data && res.fileType) {
        // Handle Base64 or string raw data
        const content = format === 'EXCEL' ? Buffer.from(res.data, 'base64') : res.data;
        const blob = new Blob([content], { type: res.fileType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${getTitle().replace(/ /g, '_')}.${format.toLowerCase()}`;
        link.click();
      }
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
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
            {['PDF', 'EXCEL', 'CSV'].map(fmt => (
              <label key={fmt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${format === fmt ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="format" value={fmt} checked={format === fmt} onChange={() => setFormat(fmt as any)} className="hidden" />
                <FileType size={18} />
                <span className="font-bold text-sm">{fmt}</span>
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
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Eye size={16} /> Preview
            </button>
            <button 
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
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
      {previewData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden">
          <h3 className="font-bold text-slate-800 mb-4">Preview Data (JSON)</h3>
          <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs overflow-x-auto max-h-[400px]">
            {JSON.stringify(previewData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
