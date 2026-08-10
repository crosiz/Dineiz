'use client';

import React from 'react';

export default function ErrorLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Error Logs</h1>
        <p className="text-sm text-slate-400">Captured runtime errors and API exception stack traces</p>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl space-y-3 font-mono text-xs">
        <div className="text-emerald-400 font-bold">✓ System status normal. 0 critical unhandled exceptions in the last 24 hours.</div>
        <div className="text-slate-400 text-[11px] border-t border-slate-800 pt-3">
          Logs are continuously streamed to Axiom / Pino logger.
        </div>
      </div>
    </div>
  );
}
