'use client';

import React, { useEffect, useState } from 'react';
import { Package, Settings, Users, Banknote, Edit3, Save, X, Search } from 'lucide-react';

export default function PlansManagementPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  
  // For tenant override
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [overrideTenant, setOverrideTenant] = useState<any | null>(null);
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideValue, setOverrideValue] = useState('');

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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Plan Management</h1>
          <p className="text-sm text-slate-400">Configure subscription plans, limits, and features globally</p>
        </div>
        <button
          onClick={() => setShowOverrideModal(true)}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors border border-slate-700"
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
            <div key={plan.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{plan.id}</p>
                </div>
                <button
                  onClick={() => setEditingPlan(JSON.parse(JSON.stringify(plan)))}
                  className="p-2 bg-slate-900 rounded-lg text-slate-400 hover:text-white border border-slate-800"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4 mb-5 pb-5 border-b border-slate-800/80">
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Tenants</div>
                  <div className="text-lg font-bold text-white">{plan.tenantsCount}</div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5"/> MRR</div>
                  <div className="text-lg font-bold text-emerald-400">
                    Rs {plan.mrr.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pricing</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-500 text-xs block">Monthly</span>
                      <span className="text-white font-medium">Rs {plan.price?.monthly}</span>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded border border-slate-800/50">
                      <span className="text-slate-500 text-xs block">Annual</span>
                      <span className="text-white font-medium">Rs {plan.price?.annual}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Limits</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(plan.limits).map(([k, v]: any) => (
                      <div key={k} className="flex justify-between items-center py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">{k}</span>
                        <span className="text-white font-mono">{v === -1 ? 'âˆž' : v}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSavePlan} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 p-5 shrink-0">
              <h3 className="text-lg font-bold text-white">Edit Plan: {editingPlan.name}</h3>
              <button type="button" onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={editingPlan.name}
                    onChange={e => setEditingPlan({...editingPlan, name: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editingPlan.displayName || ''}
                    onChange={e => setEditingPlan({...editingPlan, displayName: e.target.value})}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-3">Pricing ({editingPlan.currency})</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Monthly</label>
                    <input
                      type="number"
                      value={editingPlan.price.monthly}
                      onChange={e => setEditingPlan({...editingPlan, price: { ...editingPlan.price, monthly: Number(e.target.value) }})}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Annual</label>
                    <input
                      type="number"
                      value={editingPlan.price.annual}
                      onChange={e => setEditingPlan({...editingPlan, price: { ...editingPlan.price, annual: Number(e.target.value) }})}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-3">Limits (-1 for unlimited)</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(editingPlan.limits).map(([k, v]: any) => (
                    <div key={k} className="flex items-center gap-3">
                      <label className="text-xs text-slate-400 w-1/2">{k}</label>
                      <input
                        type="number"
                        value={v}
                        onChange={e => handleUpdateLimit(k, e.target.value)}
                        className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white mb-3">Features</h4>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(editingPlan.features).map(([k, v]: any) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800/50">
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={e => handleUpdateFeature(k, e.target.checked)}
                        className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500/20"
                      />
                      <span className="text-xs text-slate-300">{k}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 shrink-0 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingPlan(null)} className="px-4 py-2 text-sm font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white">Override Plan Feature</h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              This feature will be fully implemented alongside the business creation API. It will allow you to select a specific tenant and override individual limits or features.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setShowOverrideModal(false)} className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
