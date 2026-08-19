'use client';
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, MoreVertical, X } from 'lucide-react';
import { apiPost } from '@/lib/api-client';
import { PageLoader } from '@/components/ui/Spinner';

export function AnomalyList({ anomalies, loading, onRefresh }: { anomalies: any[], loading: boolean, onRefresh: () => void }) {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);

  if (loading) {
    return <PageLoader label="Loading anomalies..." />;
  }

  if (anomalies.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">All Clear!</h3>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          No anomalies detected based on your current filters and thresholds. Your operations are running smoothly.
        </p>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-black flex items-center gap-1"><ShieldAlert size={12}/> CRITICAL</span>;
      case 'HIGH': return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><AlertTriangle size={12}/> HIGH</span>;
      case 'MEDIUM': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Info size={12}/> MEDIUM</span>;
      case 'LOW': return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">LOW</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{severity}</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
            <th className="p-4 pl-6">Severity</th>
            <th className="p-4">Type</th>
            <th className="p-4">Branch</th>
            <th className="p-4">Detected At</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right pr-6">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {anomalies.map(anomaly => (
            <tr key={anomaly.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="p-4 pl-6">{getSeverityBadge(anomaly.severity)}</td>
              <td className="p-4">
                <p className="font-bold text-slate-800">{anomaly.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{anomaly.description}</p>
              </td>
              <td className="p-4 text-sm font-medium text-slate-700">{anomaly.branch?.name || 'Unknown'}</td>
              <td className="p-4 text-sm text-slate-600">{format(new Date(anomaly.detectedAt), 'MMM d, yyyy h:mm a')}</td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  anomaly.status === 'OPEN' ? 'bg-slate-100 text-slate-700' :
                  anomaly.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                  anomaly.status === 'FALSE_POSITIVE' ? 'bg-indigo-100 text-indigo-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {anomaly.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="p-4 pr-6 text-right">
                <button 
                  onClick={() => setSelectedAnomaly(anomaly)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedAnomaly && (
        <AnomalyDetailPanel 
          anomaly={selectedAnomaly} 
          onClose={() => setSelectedAnomaly(null)} 
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function AnomalyDetailPanel({ anomaly, onClose, onRefresh }: { anomaly: any, onClose: () => void, onRefresh: () => void }) {
  const [note, setNote] = useState(anomaly.resolutionNote || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      await apiPost(`/api/anomalies/${anomaly.id}/status`, { status, resolutionNote: note });
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Anomaly Details</h2>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Type & Description</h3>
          <p className="text-lg font-black text-slate-800">{anomaly.type.replace(/_/g, ' ')}</p>
          <p className="text-slate-600 mt-1">{anomaly.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Severity</h3>
            <p className="font-bold text-slate-800">{anomaly.severity}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Status</h3>
            <p className="font-bold text-slate-800">{anomaly.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Branch</h3>
            <p className="font-bold text-slate-800">{anomaly.branch?.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Detected</h3>
            <p className="font-bold text-slate-800">{format(new Date(anomaly.detectedAt), 'MMM d, h:mm a')}</p>
          </div>
        </div>

        {anomaly.affectedUser && (
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Involved Staff</h3>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="font-bold text-slate-800">{anomaly.affectedUser.name}</p>
              <p className="text-sm text-slate-500">{anomaly.affectedUser.email || 'No email'}</p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Investigation Notes</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={anomaly.status !== 'OPEN'}
            className="w-full h-32 p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Add your investigation findings or resolution details here..."
          />
        </div>
      </div>

      {anomaly.status === 'OPEN' && (
        <div className="p-6 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-2">
          <button 
            disabled={isUpdating}
            onClick={() => updateStatus('FALSE_POSITIVE')}
            className="col-span-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors text-sm"
          >
            False Positive
          </button>
          <button 
            disabled={isUpdating}
            onClick={() => updateStatus('RESOLVED')}
            className="col-span-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-colors text-sm"
          >
            Resolve Anomaly
          </button>
        </div>
      )}
    </div>
  );
}
