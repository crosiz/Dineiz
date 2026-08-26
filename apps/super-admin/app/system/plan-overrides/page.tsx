'use client';

import React, { useEffect, useState } from 'react';
import { Sliders, Plus, X, Trash2, RefreshCw, Search } from 'lucide-react';

interface PlanOverride {
  id: string;
  tenantId: string;
  tenantName: string | null;
  tenantPlan: string | null;
  featureKey: string;
  limit: number;
  reason: string;
  grantedBy: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
}

interface TenantOption {
  id: string;
  name: string;
}

const FEATURE_KEYS = ['maxBranches', 'maxStaff'];

export default function PlanOverridesPage() {
  const [overrides, setOverrides] = useState<PlanOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Tenant picker
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  // Form fields
  const [featureKey, setFeatureKey] = useState('maxBranches');
  const [limit, setLimit] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchOverrides = () => {
    setLoading(true);
    fetch('/api/system/plan-overrides')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.overrides) setOverrides(d.overrides);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverrides();
  }, []);

  useEffect(() => {
    if (!showModal) return;
    fetch('/api/clients')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.clients) setTenants(d.clients.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [showModal]);

  const resetForm = () => {
    setSelectedTenant(null);
    setTenantSearch('');
    setFeatureKey('maxBranches');
    setLimit('');
    setReason('');
    setExpiresAt('');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedTenant) {
      setFormError('Please select a tenant.');
      return;
    }
    if (limit === '' || Number.isNaN(Number(limit))) {
      setFormError('Please enter a numeric limit.');
      return;
    }
    if (!reason.trim()) {
      setFormError('A reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/system/plan-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          featureKey,
          limit: Number(limit),
          reason: reason.trim(),
          expiresAt: expiresAt || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'Failed to create override');
      } else {
        setShowModal(false);
        resetForm();
        fetchOverrides();
      }
    } catch (err) {
      console.error(err);
      setFormError('Network error while creating override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (override: PlanOverride) => {
    if (!confirm(`Revoke the ${override.featureKey} override for ${override.tenantName}? The tenant will revert to their plan default.`)) return;
    try {
      const res = await fetch(`/api/system/plan-overrides/${override.id}`, { method: 'DELETE' });
      if (res.ok) fetchOverrides();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to revoke override');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTenants = tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Plan Overrides</h1>
          <p className="text-sm text-slate-500">Grant a tenant a numeric limit ceiling (branches, staff) different from their plan default</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOverrides}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Grant Override</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <th className="py-3.5 px-4">Tenant</th>
              <th className="py-3.5 px-4">Plan</th>
              <th className="py-3.5 px-4">Feature Key</th>
              <th className="py-3.5 px-4 text-center">Limit</th>
              <th className="py-3.5 px-4">Reason</th>
              <th className="py-3.5 px-4">Expires</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading overrides...</td></tr>
            ) : overrides.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">No plan overrides granted yet.</td></tr>
            ) : (
              overrides.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{o.tenantName || 'Unknown'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                      {o.tenantPlan || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">{o.featureKey}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{o.limit === -1 ? 'Unlimited' : o.limit}</td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-500" title={o.reason}>{o.reason}</td>
                  <td className="py-3 px-4">
                    {o.expiresAt ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${o.isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {new Date(o.expiresAt).toLocaleDateString()}{o.isExpired ? ' (expired)' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(o)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Revoke</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Grant Override Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-600" />
                <span>Grant Plan Override</span>
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="relative">
                <label className="block text-slate-700 font-semibold mb-1">Tenant</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tenant by name..."
                    value={selectedTenant ? selectedTenant.name : tenantSearch}
                    onChange={(e) => {
                      setTenantSearch(e.target.value);
                      setSelectedTenant(null);
                      setTenantDropdownOpen(true);
                    }}
                    onFocus={() => setTenantDropdownOpen(true)}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                {tenantDropdownOpen && !selectedTenant && filteredTenants.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                    {filteredTenants.slice(0, 20).map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          setSelectedTenant(t);
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
                  value={featureKey}
                  onChange={(e) => setFeatureKey(e.target.value)}
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
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason <span className="text-orange-500">*</span></label>
                <textarea
                  rows={2}
                  placeholder="e.g. Enterprise pilot needs 2 extra branches temporarily"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expires At (optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {formError && (
                <div className="text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{formError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Grant Override'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
