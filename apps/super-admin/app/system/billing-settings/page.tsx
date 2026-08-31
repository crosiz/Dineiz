'use client';

import React, { useEffect, useState } from 'react';
import { Landmark, Smartphone, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BillingSettings {
  bankName: string | null;
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  bankIban: string | null;
  jazzCashNumber: string | null;
  jazzCashAccountTitle: string | null;
  easypaisaNumber: string | null;
  easypaisaAccountTitle: string | null;
}

const EMPTY: BillingSettings = {
  bankName: '',
  bankAccountTitle: '',
  bankAccountNumber: '',
  bankIban: '',
  jazzCashNumber: '',
  jazzCashAccountTitle: '',
  easypaisaNumber: '',
  easypaisaAccountTitle: '',
};

export default function BillingSettingsPage() {
  const [form, setForm] = useState<BillingSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/system/billing-settings')
      .then((res) => res.json())
      .then((d) => {
        if (d?.settings) {
          setForm({
            bankName: d.settings.bankName ?? '',
            bankAccountTitle: d.settings.bankAccountTitle ?? '',
            bankAccountNumber: d.settings.bankAccountNumber ?? '',
            bankIban: d.settings.bankIban ?? '',
            jazzCashNumber: d.settings.jazzCashNumber ?? '',
            jazzCashAccountTitle: d.settings.jazzCashAccountTitle ?? '',
            easypaisaNumber: d.settings.easypaisaNumber ?? '',
            easypaisaAccountTitle: d.settings.easypaisaAccountTitle ?? '',
          });
        }
      })
      .catch(() => setError('Failed to load billing settings'))
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof BillingSettings, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/system/billing-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-400 py-12 text-center">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Details</h1>
        <p className="text-sm text-slate-500">
          These appear on unpaid invoices so a tenant knows where to send payment. Leave any section blank to omit it.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
            <Landmark className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Bank Transfer</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank name</label>
            <input
              value={form.bankName ?? ''}
              onChange={(e) => update('bankName', e.target.value)}
              placeholder="e.g. Meezan Bank"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account title</label>
            <input
              value={form.bankAccountTitle ?? ''}
              onChange={(e) => update('bankAccountTitle', e.target.value)}
              placeholder="Dineiz (Pvt) Ltd"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account number</label>
            <input
              value={form.bankAccountNumber ?? ''}
              onChange={(e) => update('bankAccountNumber', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">IBAN (optional)</label>
            <input
              value={form.bankIban ?? ''}
              onChange={(e) => update('bankIban', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">JazzCash</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">JazzCash number</label>
            <input
              value={form.jazzCashNumber ?? ''}
              onChange={(e) => update('jazzCashNumber', e.target.value)}
              placeholder="03XX-XXXXXXX"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account title</label>
            <input
              value={form.jazzCashAccountTitle ?? ''}
              onChange={(e) => update('jazzCashAccountTitle', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Easypaisa</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Easypaisa number</label>
            <input
              value={form.easypaisaNumber ?? ''}
              onChange={(e) => update('easypaisaNumber', e.target.value)}
              placeholder="03XX-XXXXXXX"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account title</label>
            <input
              value={form.easypaisaAccountTitle ?? ''}
              onChange={(e) => update('easypaisaAccountTitle', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving…' : 'Save Payment Details'}</span>
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
