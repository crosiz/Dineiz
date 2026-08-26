'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLANS, getPlanDefinition } from '@dineiz/schemas';
import {
  UserPlus,
  Building2,
  Mail,
  Phone,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';

interface NewBranchRow {
  name: string;
  city: string;
  address: string;
}

export default function AddNewClientPage() {
  const router = useRouter();

  // Form State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  // Password Generator
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const [password, setPassword] = useState(generatePassword());
  const [plan, setPlan] = useState('STARTER');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [trialDays, setTrialDays] = useState('14');
  const [customTrialEndDate, setCustomTrialEndDate] = useState('');
  const [city, setCity] = useState('Lahore');
  const [notes, setNotes] = useState('');

  const planLimits = getPlanDefinition(plan).limits;
  const maxBranchesForPlan = planLimits.maxBranches === -1 ? 50 : planLimits.maxBranches;

  const [multiLocation, setMultiLocation] = useState(false);
  const [branchRows, setBranchRows] = useState<NewBranchRow[]>([{ name: '', city: '', address: '' }]);

  const addBranchRow = () => {
    if (branchRows.length >= maxBranchesForPlan) return;
    setBranchRows([...branchRows, { name: '', city: '', address: '' }]);
  };
  const removeBranchRow = (idx: number) => {
    setBranchRows(branchRows.filter((_, i) => i !== idx));
  };
  const updateBranchRow = (idx: number, field: keyof NewBranchRow, value: string) => {
    setBranchRows(branchRows.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflictDetails, setConflictDetails] = useState<{
    type: 'email' | 'phone';
    value: string;
    userName: string;
    role: string;
    restaurantName: string;
  } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConflictDetails(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ownerName,
          ownerEmail,
          ownerPhone,
          password,
          plan,
          billingCycle,
          trialDays: Number(trialDays),
          trialEndsAt: customTrialEndDate || undefined,
          branches: multiLocation
            ? branchRows.filter((b) => b.name.trim()).map((b) => ({ ...b, city: b.city.trim() || city }))
            : undefined,
          city,
          notes,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server error (${res.status})` };
      }

      if (!res.ok) {
        if (data.conflictDetails) {
          setConflictDetails(data.conflictDetails);
        }
        throw new Error(data.error || 'Failed to create client account');
      }

      setCreatedCredentials({
        tenantId: data.credentials?.tenantId,
        restaurantName: data.credentials?.restaurantName,
        ownerEmail: data.credentials?.ownerEmail,
        password: data.credentials?.password,
        plan: data.credentials?.plan,
        loginUrl: data.credentials?.loginUrl || 'http://localhost:3000/login',
        branches: data.credentials?.branches || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCredentials) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Client Account Successfully Created!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Account provisioned for <strong className="text-orange-600">{createdCredentials.restaurantName}</strong>. A welcome email with credentials has been dispatched.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-left space-y-3 mt-6">
            <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider">Account Credentials Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Console URL:</span>
                <span className="text-slate-900 font-mono">{createdCredentials.loginUrl}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Owner Email:</span>
                <span className="text-slate-900 font-mono">{createdCredentials.ownerEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded text-orange-600 font-mono font-bold border border-slate-200">
                    {createdCredentials.password}
                  </code>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block">Subscription Plan:</span>
                <span className="text-slate-900 font-bold">{createdCredentials.plan}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 mt-3">
              {createdCredentials.branches && createdCredentials.branches.length > 0 ? (
                <>
                  <span className="text-slate-400 text-xs block mb-1">Generated Branch POS Access Codes:</span>
                  <div className="space-y-1">
                    {createdCredentials.branches.map((b: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-slate-600">{b.branchName}</span>
                        <code className="text-orange-600 font-bold">{b.code}</code>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <Info className="w-4 h-4 text-orange-500 shrink-0" />
                  <span><strong>Self-Serve Branches Enabled:</strong> The tenant admin can create their branches, configure tables, and launch POS terminals from their dashboard.</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-4 pt-4">
            <button
              onClick={() => {
                setCreatedCredentials(null);
                setName('');
                setOwnerName('');
                setOwnerEmail('');
                setPassword(generatePassword());
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
            >
              Add Another Client
            </button>
            <Link
              href={`/clients/${createdCredentials.tenantId}`}
              className="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-sm"
              style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
            >
              View Client Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <Link href="/clients" className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Client</h1>
          <p className="text-sm text-slate-500">Manually onboard an enterprise client or sales signup</p>
        </div>
      </div>

      {conflictDetails && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 text-orange-900 space-y-3 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className="font-bold text-orange-700 text-sm">
                {conflictDetails.type === 'email' ? 'Owner Email Already Linked' : 'Owner Phone Already Linked'}
              </h4>
              <p className="text-xs text-orange-800/90 leading-relaxed">
                The {conflictDetails.type} <code className="bg-orange-100 px-1.5 py-0.5 rounded text-orange-700 font-mono font-bold">{conflictDetails.value}</code> is already linked to an existing account on the platform:
              </p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-orange-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Linked User</span>
                  <span className="text-slate-900 font-medium">{conflictDetails.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Role</span>
                  <span className="text-orange-600 font-mono">{conflictDetails.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Restaurant</span>
                  <span className="text-slate-900 font-semibold">{conflictDetails.restaurantName}</span>
                </div>
              </div>
              <p className="text-[11px] text-orange-700/80 pt-1">
                Please enter a distinct {conflictDetails.type} for this new client, or edit the existing staff member in their respective dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !conflictDetails && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Onboarding Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm space-y-8">
        {/* Section 1: Restaurant Identity */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Restaurant Identity & Owner Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Restaurant Name <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Spice Bazaar Fine Dining"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Full Name <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tariq Khan"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Email <span className="text-orange-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="owner@restaurant.com"
                  value={ownerEmail}
                  onChange={(e) => {
                    setOwnerEmail(e.target.value);
                    if (conflictDetails?.type === 'email') setConflictDetails(null);
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                    conflictDetails?.type === 'email'
                      ? 'border-orange-400 ring-2 ring-orange-500/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Phone (Pakistani Format)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="+92-300-1234567"
                  value={ownerPhone}
                  onChange={(e) => {
                    setOwnerPhone(e.target.value);
                    if (conflictDetails?.type === 'phone') setConflictDetails(null);
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                    conflictDetails?.type === 'phone'
                      ? 'border-orange-400 ring-2 ring-orange-500/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Credentials */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Account Password Generator
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Temporary Password (Auto-Generated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={password}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-orange-600 font-mono font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPassword}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200"
              >
                {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPass ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200"
              >
                Regenerate
              </button>
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              Password will be sent automatically to the owner's email address via Resend.
            </span>
          </div>
        </div>

        {/* Section 3: Subscription & Billing */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Subscription & Trial Configuration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subscription Plan</label>
              <select
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  const newLimit = getPlanDefinition(e.target.value).limits.maxBranches;
                  const cap = newLimit === -1 ? 50 : newLimit;
                  if (branchRows.length > cap) setBranchRows(branchRows.slice(0, cap));
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.monthlyPrice === null ? 'Custom pricing' : p.monthlyPrice === 0 ? 'PKR 0/mo' : `PKR ${p.monthlyPrice.toLocaleString()}/mo`})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Branch limit: {planLimits.maxBranches === -1 ? 'Unlimited' : planLimits.maxBranches} &middot; Staff limit: {planLimits.maxStaff === -1 ? 'Unlimited' : planLimits.maxStaff}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual (15% discount)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trial Days</label>
              <input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="14"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <span className="text-[10px] text-slate-400">Set 0 for immediate billing</span>
            </div>
          </div>
        </div>

        {/* Section 4: Location & Notes */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider border-b border-slate-100 pb-2">
            4. Location & Internal Notes
          </h3>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={multiLocation}
              onChange={(e) => setMultiLocation(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-orange-600"
            />
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900 block mb-0.5">This business already operates multiple locations</span>
              Leave unchecked to start with one branch — "Main Branch" — which the owner can rename and configure from their dashboard. The owner can add branches themselves up to the plan's limit ({planLimits.maxBranches === -1 ? 'unlimited' : planLimits.maxBranches}).
            </div>
          </label>

          {multiLocation && (
            <div className="space-y-2 pl-1">
              {branchRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    placeholder={`Branch ${idx + 1} name`}
                    value={row.name}
                    onChange={(e) => updateBranchRow(idx, 'name', e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="City"
                    value={row.city}
                    onChange={(e) => updateBranchRow(idx, 'city', e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={row.address}
                    onChange={(e) => updateBranchRow(idx, 'address', e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeBranchRow(idx)}
                    disabled={branchRows.length <= 1}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBranchRow}
                disabled={branchRows.length >= maxBranchesForPlan}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed py-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add another branch
              </button>
              {branchRows.length >= maxBranchesForPlan && (
                <span className="text-[10px] text-slate-400 block">Plan limit reached for this business.</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Primary City / Region</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            >
              <option value="Lahore">Lahore (LHR)</option>
              <option value="Karachi">Karachi (KHI)</option>
              <option value="Islamabad">Islamabad (ISL)</option>
              <option value="Rawalpindi">Rawalpindi (RWP)</option>
              <option value="Faisalabad">Faisalabad (FSD)</option>
              <option value="Peshawar">Peshawar (PEW)</option>
              <option value="Multan">Multan (MUX)</option>
              <option value="Quetta">Quetta (UET)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={3}
              placeholder="Add internal notes about sales agreement, custom pricing, or contact history..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 border-t border-slate-100 pt-6">
          <Link href="/clients" className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Onboard Client Account</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
