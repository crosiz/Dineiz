'use client';

import React, { useEffect, useState } from 'react';
import { Package, Settings, Users, Banknote, Edit3, Save, X, Search } from 'lucide-react';

interface TenantOption {
  id: string;
  name: string;
}

const FEATURE_KEYS = ['maxBranches', 'maxStaff'];

export default function PlansManagementPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  // For tenant override
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [overrideTenant, setOverrideTenant] = useState<TenantOption | null>(null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [overrideKey, setOverrideKey] = useState('maxBranches');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  const fetchPlans = () => {
    setLoading(true);
    fetch('/api/plans')
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((d) => setPlans(d.plans || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!showOverrideModal) return;
    fetch('/api/clients')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.clients) setTenants(d.clients.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [showOverrideModal]);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      const res = await fetch('/api/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPlan),
      });
      if (res.ok) {
        setEditingPlan(null);
        fetchPlans();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update plan');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateLimit = (key: string, value: string) => {
    setEditingPlan((prev: any) => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: parseInt(value, 10),
      }
    }));
  };

  const handleUpdateFeature = (key: string, value: boolean) => {
    setEditingPlan((prev: any) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      }
    }));
  };

  const resetOverrideForm = () => {
    setOverrideTenant(null);
    setTenantSearch('');
    setOverrideKey('maxBranches');
    setOverrideValue('');
    setOverrideReason('');
    setOverrideExpiresAt('');
    setOverrideError('');
    setOverrideSuccess(false);
  };

  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError('');
    if (!overrideTenant) {
      setOverrideError('Please select a tenant.');
      return;
    }
    if (overrideValue === '' || Number.isNaN(Number(overrideValue))) {
      setOverrideError('Please enter a numeric limit.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('A reason is required.');
      return;
    }

    setOverrideSubmitting(true);
    try {
      const res = await fetch('/api/system/plan-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: overrideTenant.id,
          featureKey: overrideKey,
          limit: Number(overrideValue),
          reason: overrideReason.trim(),
          expiresAt: overrideExpiresAt || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOverrideError(data.error || 'Failed to create override');
      } else {
        setOverrideSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setOverrideError('Network error while creating override');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Plan Management</h1>
          <p className="text-sm text-slate-500">Configure subscription plans, limits, and features globally</p>
        </div>
        <button
          onClick={() => { resetOverrideForm(); setShowOverrideModal(true); }}
          className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors border border-slate-200 shadow-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Override Plan for Tenant</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading plans...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{plan.id}</p>
                </div>
                <button
                  onClick={() => setEditingPlan(JSON.parse(JSON.stringify(plan)))}
                  className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-slate-900 border border-slate-200"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4 mb-5 pb-5 border-b border-slate-100">
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Tenants</div>
                  <div className="text-lg font-bold text-slate-900">{plan.tenantsCount}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5"/> MRR</div>
                  <div className="text-lg font-bold text-emerald-600">
                    Rs {plan.mrr.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pricing</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-400 text-xs block">Monthly</span>
                      <span className="text-slate-900 font-medium">Rs {plan.price?.monthly}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-400 text-xs block">Annual</span>
                      <span className="text-slate-900 font-medium">Rs {plan.price?.annual}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Limits</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(plan.limits).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-900 font-mono">{v === -1 ? '∞' : v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSavePlan} className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 shrink-0">
              <h3 className="text-lg font-bold text-slate-900">Edit Plan: {editingPlan.name}</h3>
              <button type="button" onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={editingPlan.name}
                    onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editingPlan.displayName || ''}
                    onChange={e => setEditingPlan({...editingPlan, displayName: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Pricing ({editingPlan.currency})</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Monthly</label>
                    <input
                      type="number"
                      value={editingPlan.price.monthly}
                      onChange={e => setEditingPlan({...editingPlan, price: { ...editingPlan.price, monthly: Number(e.target.value) }})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Annual</label>
                    <input
                      type="number"
                      value={editingPlan.price.annual}
                      onChange={e => setEditingPlan({...editingPlan, price: { ...editingPlan.price, annual: Number(e.target.value) }})}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Limits (-1 for unlimited)</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(editingPlan.limits).map(([k, v]: any) => (
                    <div key={k} className="flex items-center gap-3">
                      <label className="text-xs text-slate-500 w-1/2">{k}</label>
                      <input
                        type="number"
                        value={v}
                        onChange={e => handleUpdateLimit(k, e.target.value)}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Features</h4>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(editingPlan.features).map(([k, v]: any) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={e => handleUpdateFeature(k, e.target.checked)}
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500/20"
                      />
                      <span className="text-xs text-slate-600">{k}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingPlan(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Override Plan for Tenant</h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {overrideSuccess ? (
              <div className="space-y-4">
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  Override granted for <strong>{overrideTenant?.name}</strong>. Manage all overrides from{' '}
                  <span className="font-semibold">System &rarr; Plan Overrides</span>.
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => resetOverrideForm()}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Grant Another
                  </button>
                  <button
                    onClick={() => setShowOverrideModal(false)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitOverride} className="space-y-3 text-xs">
                <div className="relative">
                  <label className="block text-slate-700 font-semibold mb-1">Tenant</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search tenant by name..."
                      value={overrideTenant ? overrideTenant.name : tenantSearch}
                      onChange={(e) => {
                        setTenantSearch(e.target.value);
                        setOverrideTenant(null);
                        setTenantDropdownOpen(true);
                      }}
                      onFocus={() => setTenantDropdownOpen(true)}
                      className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  {tenantDropdownOpen && !overrideTenant && filteredTenants.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                      {filteredTenants.slice(0, 20).map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => {
                            setOverrideTenant(t);
                            setTenantDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Feature Key</label>
                  <select
                    value={overrideKey}
                    onChange={(e) => setOverrideKey(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {FEATURE_KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Limit (-1 for unlimited)</label>
                  <input
                    type="number"
                    placeholder="e.g. 5"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reason <span className="text-orange-500">*</span></label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Enterprise pilot needs 2 extra branches temporarily"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expires At (optional)</label>
                  <input
                    type="date"
                    value={overrideExpiresAt}
                    onChange={(e) => setOverrideExpiresAt(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                {overrideError && (
                  <div className="text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{overrideError}</div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowOverrideModal(false)} className="px-4 py-2 font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
                  <button
                    type="submit"
                    disabled={overrideSubmitting}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {overrideSubmitting ? 'Saving...' : 'Grant Override'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
