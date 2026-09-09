'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, X, Ban, RefreshCw, Search, Download, AlertTriangle } from 'lucide-react';

interface StandaloneLicenseRow {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantPlan: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  licenseId: string;
  restaurantName: string;
  machineFingerprint: string;
  issuedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
}

interface TenantOption {
  id: string;
  name: string;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StandaloneLicensesPage() {
  const [licenses, setLicenses] = useState<StandaloneLicenseRow[]>([]);
  const [signingConfigured, setSigningConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [buyerMode, setBuyerMode] = useState<'tenant' | 'offline'>('tenant');

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantOption | null>(null);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [restaurantName, setRestaurantName] = useState('');
  const [machineFingerprint, setMachineFingerprint] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');

  const fetchLicenses = () => {
    setLoading(true);
    fetch('/api/system/standalone-licenses')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.licenses) setLicenses(d.licenses);
        if (d && typeof d.signingConfigured === 'boolean') setSigningConfigured(d.signingConfigured);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  useEffect(() => {
    if (!showModal || buyerMode !== 'tenant') return;
    setTenantsLoading(true);
    setTenantsError('');
    fetch('/api/clients')
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `Failed to load tenants (${res.status})`);
        return body;
      })
      .then((d) => {
        const list = (d?.clients ?? []).map((c: any) => ({ id: c.id, name: c.name }));
        setTenants(list);
        if (list.length === 0) setTenantsError('No tenants exist yet — create one from Clients first.');
      })
      .catch((err) => {
        setTenants([]);
        setTenantsError(err instanceof Error ? err.message : 'Failed to load tenants');
      })
      .finally(() => setTenantsLoading(false));
  }, [showModal, buyerMode]);

  const resetForm = () => {
    setBuyerMode('tenant');
    setSelectedTenant(null);
    setTenantSearch('');
    setTenantsError('');
    setBuyerName('');
    setBuyerEmail('');
    setBuyerPhone('');
    setRestaurantName('');
    setMachineFingerprint('');
    setExpiresInDays('');
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (buyerMode === 'tenant' && !selectedTenant) {
      setFormError('Please select a tenant, or switch to "Offline-only sale" if this buyer has no cloud account.');
      return;
    }
    if (buyerMode === 'offline' && !buyerName.trim()) {
      setFormError("The buyer's name is required for an offline-only sale.");
      return;
    }
    if (!restaurantName.trim()) {
      setFormError('Restaurant name is required.');
      return;
    }
    if (!machineFingerprint.trim()) {
      setFormError("The customer's machine ID (shown on their Activation screen) is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/system/standalone-licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: buyerMode === 'tenant' ? selectedTenant!.id : undefined,
          buyerName: buyerMode === 'offline' ? buyerName.trim() : undefined,
          buyerEmail: buyerMode === 'offline' ? buyerEmail.trim() || undefined : undefined,
          buyerPhone: buyerMode === 'offline' ? buyerPhone.trim() || undefined : undefined,
          restaurantName: restaurantName.trim(),
          machineFingerprint: machineFingerprint.trim(),
          expiresInDays: expiresInDays || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'Failed to issue license');
      } else {
        const filenameSource = buyerMode === 'tenant' ? selectedTenant!.name : buyerName;
        downloadJson(`dineiz-license-${filenameSource.replace(/\s+/g, '-').toLowerCase()}.json`, data.signedLicense);
        setShowModal(false);
        resetForm();
        fetchLicenses();
      }
    } catch (err) {
      console.error(err);
      setFormError('Network error while issuing license');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedownload = async (license: StandaloneLicenseRow) => {
    try {
      const res = await fetch(`/api/system/standalone-licenses/${license.id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.signedLicense) {
        downloadJson(`dineiz-license-${license.restaurantName.replace(/\s+/g, '-').toLowerCase()}.json`, data.signedLicense);
      } else {
        alert(data.error || 'Failed to download license');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRevoke = async (license: StandaloneLicenseRow) => {
    const reason = prompt(
      `Mark the license for "${license.restaurantName}" as revoked?\n\nThis is record-keeping only — the offline app has no way to be notified, so this does NOT stop the license from working on that machine. Enter a reason:`
    );
    if (reason === null) return;
    try {
      const res = await fetch(`/api/system/standalone-licenses/${license.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) fetchLicenses();
      else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to revoke license');
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Standalone Licenses</h1>
          <p className="text-sm text-slate-500">Issue and track one-time-purchase licenses for Dineiz Standalone (the offline POS)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLicenses}
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
            <span>Issue License</span>
          </button>
        </div>
      </div>

      {!signingConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>License signing is not configured on this deployment.</strong> Set the{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">STANDALONE_LICENSE_PRIVATE_KEY</code>{' '}
            environment variable (the private key generated for this product — never commit it) before issuing licenses.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <th className="py-3.5 px-4">Tenant</th>
              <th className="py-3.5 px-4">Restaurant</th>
              <th className="py-3.5 px-4">Machine ID</th>
              <th className="py-3.5 px-4">Issued</th>
              <th className="py-3.5 px-4">Expires</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading licenses...</td></tr>
            ) : licenses.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">No licenses issued yet.</td></tr>
            ) : (
              licenses.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    {l.tenantId ? (
                      <span className="font-bold text-slate-900">{l.tenantName || 'Unknown'}</span>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-900">{l.buyerName || 'Unknown buyer'}</span>
                        <span className="ml-1.5 rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 align-middle">
                          OFFLINE
                        </span>
                        {(l.buyerEmail || l.buyerPhone) && (
                          <p className="text-[10px] text-slate-400">{[l.buyerEmail, l.buyerPhone].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">{l.restaurantName}</td>
                  <td className="py-3 px-4 max-w-[160px] truncate font-mono text-slate-500" title={l.machineFingerprint}>
                    {l.machineFingerprint}
                  </td>
                  <td className="py-3 px-4">{new Date(l.issuedAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    {l.expiresAt ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {new Date(l.expiresAt).toLocaleDateString()}{l.isExpired ? ' (expired)' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border ${
                        l.status === 'REVOKED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                      title={l.status === 'REVOKED' ? l.revokedReason ?? undefined : undefined}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleRedownload(l)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                      {l.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevoke(l)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-600" />
                <span>Issue Standalone License</span>
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setBuyerMode('tenant')}
                  className={`rounded-lg py-1.5 font-semibold ${buyerMode === 'tenant' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  Existing cloud tenant
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerMode('offline')}
                  className={`rounded-lg py-1.5 font-semibold ${buyerMode === 'offline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  Offline-only sale
                </button>
              </div>

              {buyerMode === 'offline' && (
                <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-500">
                  For a restaurant buying only the offline POS, with no Dineiz cloud account. No tenant record is created.
                </p>
              )}

              {buyerMode === 'tenant' ? (
              <div className="relative">
                <label className="block text-slate-700 font-semibold mb-1">Tenant</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={tenantsLoading ? 'Loading tenants...' : 'Search tenant by name...'}
                    value={selectedTenant ? selectedTenant.name : tenantSearch}
                    disabled={tenantsLoading}
                    onChange={(e) => {
                      setTenantSearch(e.target.value);
                      setSelectedTenant(null);
                      setTenantDropdownOpen(true);
                    }}
                    onFocus={() => setTenantDropdownOpen(true)}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:opacity-60"
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
                          if (!restaurantName) setRestaurantName(t.name);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {tenantDropdownOpen && !selectedTenant && !tenantsLoading && filteredTenants.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-500 shadow-lg">
                    {tenantsError || (tenantSearch ? `No tenant matches "${tenantSearch}".` : 'No tenants found.')}
                  </div>
                )}
                {selectedTenant && (
                  <p className="mt-1 text-[11px] text-green-700">✓ Selected — click the field again to change.</p>
                )}
              </div>
              ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Buyer name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Who you sold this to"
                    value={buyerName}
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                      if (!restaurantName) setRestaurantName(e.target.value);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Email (optional)</label>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone (optional)</label>
                    <input
                      type="text"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Restaurant name (printed on the license)</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Machine ID <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Shown on the customer's Activation screen"
                  value={machineFingerprint}
                  onChange={(e) => setMachineFingerprint(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Expires in (days, optional — blank = never)</label>
                <input
                  type="number"
                  placeholder="e.g. 365"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
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
                {submitting ? 'Signing...' : 'Issue & download'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
