'use client';

import React from 'react';

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Invoice Management</h1>
        <p className="text-sm text-slate-400">Generate and download official PDF invoices with Dineiz branding</p>
      </div>
      <div className="bg-slate-950/60 border border-slate-800 p-8 rounded-2xl text-center text-xs text-slate-400">
        Invoices generator active. Use the Generate Invoice button in any Client Detail profile to create tax invoices.
      </div>
    </div>
  );
}
