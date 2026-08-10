'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Building2,
  Mail,
  Phone,
  Lock,
  Copy,
  Check,
  Calendar,
  Layers,
  MapPin,
  FileText,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

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
  const [branchesCount, setBranchesCount] = useState('1');
  const [city, setCity] = useState('Lahore');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
          branchesCount: Number(branchesCount),
          city,
          notes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create client account');
      }

      setCreatedCredentials(data.credentials);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCredentials) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Client Successfully Onboarded!</h2>
          <p className="text-sm text-slate-300">
            Account created for <strong className="text-emerald-400">{createdCredentials.restaurantName}</strong>. Welcome email with login details has been sent.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-left space-y-3 mt-6">
            <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">Account Credentials Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Console URL:</span>
                <span className="text-white font-mono">{createdCredentials.loginUrl}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Owner Email:</span>
                <span className="text-white font-mono">{createdCredentials.ownerEmail}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-950 px-2 py-1 rounded text-amber-400 font-mono font-bold">
                    {createdCredentials.password}
                  </code>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block">Subscription Plan:</span>
                <span className="text-white font-bold">{createdCredentials.plan}</span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-3">
              <span className="text-slate-500 text-xs block mb-1">Generated Branch POS Access Codes:</span>
              <div className="space-y-1">
                {createdCredentials.branches?.map((b: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-300">{b.branchName}</span>
                    <code className="text-amber-400 font-bold">{b.code}</code>
                  </div>
                ))}
              </div>
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
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
            >
              Add Another Client
            </button>
            <Link
              href={`/clients/${createdCredentials.tenantId}`}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
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
        <Link href="/clients" className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Add New Client</h1>
          <p className="text-sm text-slate-400">Manually onboard an enterprise client or sales signup</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/60 border border-red-800 rounded-xl p-4 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Main Onboarding Form */}
      <form onSubmit={handleSubmit} className="bg-slate-950/60 border border-slate-800/80 p-6 sm:p-8 rounded-2xl shadow-xl space-y-8">
        {/* Section 1: Restaurant Identity */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider border-b border-slate-800 pb-2">
            1. Restaurant Identity & Owner Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Restaurant Name <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Spice Bazaar Fine Dining"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Owner Full Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tariq Khan"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Owner Email <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="owner@restaurant.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Owner Phone (Pakistani Format)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="+92-300-1234567"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Credentials */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider border-b border-slate-800 pb-2">
            2. Account Password Generator
          </h3>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Temporary Password (Auto-Generated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={password}
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-amber-400 font-mono font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPassword}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
              >
                {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPass ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700"
              >
                Regenerate
              </button>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Password will be sent automatically to the owner's email address via Resend.
            </span>
          </div>
        </div>

        {/* Section 3: Subscription & Billing */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider border-b border-slate-800 pb-2">
            3. Subscription & Trial Configuration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Subscription Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="FREE">Free Go (PKR 0/mo)</option>
                <option value="PRO_GO">Pro Go (PKR 12,000/mo)</option>
                <option value="STARTER">Starter (PKR 8,000/mo)</option>
                <option value="PRO">Pro (PKR 15,000/mo)</option>
                <option value="ENTERPRISE">Enterprise (PKR 35,000/mo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual (15% discount)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Trial Days</label>
              <input
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                placeholder="14"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Set 0 for immediate billing</span>
            </div>
          </div>
        </div>

        {/* Section 4: Branches & Location */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider border-b border-slate-800 pb-2">
            4. Branch & Location Configuration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Branches to Create</label>
              <input
                type="number"
                min="1"
                max="20"
                value={branchesCount}
                onChange={(e) => setBranchesCount(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">Automatically creates branch records with unique codes</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Primary City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Internal Notes</label>
            <textarea
              rows={3}
              placeholder="Add internal notes about sales agreement, custom pricing, or contact history..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 border-t border-slate-800 pt-6">
          <Link href="/clients" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
