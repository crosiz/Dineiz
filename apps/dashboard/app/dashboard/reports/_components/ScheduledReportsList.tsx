'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPut, apiDelete } from '@/lib/api-client';
import { CalendarClock, Download, Play, Pause, Trash2, Loader2, Clock } from 'lucide-react';
import { format } from 'date-fns';

export function ScheduledReportsList() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await apiGet('/api/reports/scheduled');
      setReports(res as any);
    } catch (err: any) {
      console.error(err);
    }
    setLoading(false);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await apiPut(`/api/reports/scheduled/${id}/toggle`, { status: newStatus });
      fetchReports();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;
    try {
      await apiDelete(`/api/reports/scheduled/${id}`);
      fetchReports();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <CalendarClock className="text-indigo-600" size={32} />
          Scheduled Reports
        </h2>
        <p className="text-slate-500 mt-2">Manage your automated report deliveries and view recent generations.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-slate-400">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <CalendarClock size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No scheduled reports</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto">You haven't set up any automated reports yet. Select a report from the catalog and click "Automate this Report" to set one up.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="p-4 pl-6">Report Name</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Format</th>
                <th className="p-4">Recipients</th>
                <th className="p-4">Status</th>
                <th className="p-4">Next Run</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6">
                    <p className="font-bold text-slate-800">{report.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{report.reportType.replace(/_/g, ' ')}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Clock size={14} className="text-slate-400" />
                      {report.frequency} at {report.runAtTime}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                      {report.format}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-slate-600 space-y-1">
                      {report.recipients.length > 0 && <p>{report.recipients.length} Email(s)</p>}
                      {report.whatsappNumber && <p className="text-green-600">WhatsApp: {report.whatsappNumber}</p>}
                    </div>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleStatus(report.id, report.status)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors ${
                        report.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {report.status === 'ACTIVE' ? <Play size={12}/> : <Pause size={12}/>}
                      {report.status}
                    </button>
                  </td>
                  <td className="p-4">
                    {report.nextRunAt ? (
                      <div className="text-sm text-slate-700">
                        {format(new Date(report.nextRunAt), 'MMM d, yyyy h:mm a')}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">Not scheduled</span>
                    )}
                  </td>
                  <td className="p-4 pr-6 flex items-center justify-end gap-2">
                    {report.lastFileUrl && (
                      <a 
                        href={report.lastFileUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        title="Download Last Run"
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Download size={18} />
                      </a>
                    )}
                    <button 
                      onClick={() => deleteReport(report.id)}
                      title="Delete Schedule"
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
