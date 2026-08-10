'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Filter, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/system/audit-trail?action=${actionFilter}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.logs) setLogs(d.logs);
      })
      .finally(() => setLoading(false));
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Trail</h1>
          <p className="text-sm text-slate-400">Append-only audit ledger of all super admin operations</p>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold"
        >
          <option value="ALL">All Actions</option>
          <option value="LOGIN">Super Admin Login</option>
          <option value="TENANT_CREATED">Client Created</option>
          <option value="PLAN_CHANGED">Plan Changed</option>
          <option value="PAYMENT_ADDED">Payment Added</option>
          <option value="FEATURE_OVERRIDE">Feature Flag Override</option>
          <option value="ACCOUNT_SUSPENDED">Account Suspended</option>
        </select>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3.5 px-4">Timestamp</th>
              <th className="py-3.5 px-4">Action</th>
              <th className="py-3.5 px-4">Performed By</th>
              <th className="py-3.5 px-4">Target Tenant</th>
              <th className="py-3.5 px-4">IP Address</th>
              <th className="py-3.5 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-slate-900/50">
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-white">
                      {log.superAdmin?.name || 'System Auto'}
                      <span className="block text-[10px] text-slate-500">{log.superAdmin?.email}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {log.targetTenant?.name || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {(log.before || log.after) && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="text-slate-400 hover:text-white inline-flex items-center gap-1"
                        >
                          <span>JSON Diff</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-950">
                      <td colSpan={6} className="p-4 border-b border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                          <div>
                            <span className="text-amber-500 font-bold block mb-1">State Before:</span>
                            <pre className="bg-slate-900 p-3 rounded-lg overflow-x-auto text-[11px] text-slate-300 border border-slate-800">
                              {JSON.stringify(log.before, null, 2) || 'null'}
                            </pre>
                          </div>
                          <div>
                            <span className="text-emerald-400 font-bold block mb-1">State After:</span>
                            <pre className="bg-slate-900 p-3 rounded-lg overflow-x-auto text-[11px] text-slate-300 border border-slate-800">
                              {JSON.stringify(log.after, null, 2) || 'null'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {logs.length === 0 && !loading && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No audit logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
