'use client';

import React from 'react';

export default function DunningPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Dunning & Renewal Reminders Automation</h1>
        <p className="text-sm text-slate-400">Automated daily job status for 7-day, 3-day, and 1-day subscription renewal notices</p>
      </div>
      <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl space-y-3">
        <h3 className="text-xs font-bold text-amber-400 uppercase">Daily Scheduled Job Status</h3>
        <p className="text-xs text-slate-300">
          The BullMQ automated renewal job runs daily at 09:00 AM PKT. Subscriptions expired &gt; 3 days are restricted to Free tier and past due alerts sent to Super Admin.
        </p>
      </div>
    </div>
  );
}
