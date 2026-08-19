"use client";
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import { useState } from 'react';
import useSWR from 'swr';
import { AdminOnly } from '@/components/admin-only';
import { apiFetch, API_URL } from '@/lib/api';
import { toast } from 'sonner';

export default function BillingSettingsPage() {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [switchingToPlan, setSwitchingToPlan] = useState<string | null>(null);

  const { data: sub, mutate: mutateSub } = useSWR<any>('/api/billing/subscription', apiFetch);
  const { data: historyRes } = useSWR<any>('/api/billing/history', apiFetch);
  const { data: plans } = useSWR<any>('/api/billing/plans', apiFetch);

  const history = historyRes?.payments || [];

  const handlePlanChange = async () => {
    if (!switchingToPlan) return;
    try {
      await apiFetch('/api/billing/change-plan', {
        method: 'POST',
        body: JSON.stringify({ newPlan: switchingToPlan, billingCycle }),
      });
      toast.success('Plan updated successfully');
      setSwitchingToPlan(null);
      mutateSub(); // Refresh subscription info
    } catch (err: any) {
      toast.error(err.message || 'Failed to change plan');
    }
  };

  const handleDownloadInvoice = (paymentId: string) => {
    window.open(`${API_URL}/api/billing/invoice/${paymentId}`, '_blank');
  };

  if (!sub || !plans) {
    return (
      <AdminOnly>
        <div className="pt-24 px-8 pb-12 max-w-[1200px] mx-auto min-h-screen">
          <p>Loading billing data...</p>
        </div>
      </AdminOnly>
    );
  }

  const { usage } = sub;
  const branchesPercent = usage.branchLimit ? Math.min(100, (usage.branchesUsed / usage.branchLimit) * 100) : 0;
  const storagePercent = usage.storageLimitGB ? Math.min(100, (usage.storageUsedGB / usage.storageLimitGB) * 100) : 0;

  return (
    <AdminOnly>
      <div className="pt-24 px-8 pb-12 max-w-[1200px] mx-auto text-on-surface font-body-md">
        
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end">
          <div>
            <h1 className="text-[26px] font-bold text-text-main leading-tight font-display-lg">Billing & Plan</h1>
            <p className="text-[14px] text-text-muted mt-1">Manage your subscription and payment details</p>
          </div>
        </div>

        {/* Current Plan Card */}
        <section className="w-full bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-[16px] p-8 mb-6 text-white flex flex-col md:flex-row justify-between items-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/10 blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
          <div className="relative z-10 w-full md:w-auto mb-8 md:mb-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Current Plan</span>
            <h2 className="text-[28px] font-bold mt-1 font-display-lg">{sub.planName}</h2>
            <div className="flex flex-wrap gap-2 mt-6">
              {sub.features.slice(0, 5).map((feature: string, idx: number) => (
                <span key={idx} className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-full text-[12px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> {feature}
                </span>
              ))}
            </div>
          </div>
          <div className="relative z-10 text-center md:text-right w-full md:w-auto">
            <div className="mb-6">
              {sub.plan === 'ENTERPRISE' ? (
                <span className="text-[36px] font-bold">Custom</span>
              ) : (
                <>
                  <span className="text-[36px] font-bold">{formatPKR(sub.monthlyPrice)}</span>
                  <span className="text-[16px] text-[#94A3B8]">/mo</span>
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
              {sub.plan !== 'ENTERPRISE' && (
                <button 
                  onClick={() => setSwitchingToPlan('ENTERPRISE')}
                  className="bg-primary-container hover:bg-[#E64A19] text-white px-6 py-3 rounded-lg font-bold text-sm transition-all active:scale-95 shadow-lg shadow-primary-container/20">
                  Upgrade to Enterprise
                </button>
              )}
              <button
                onClick={() => document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="border border-white/30 hover:bg-white/10 text-white px-6 py-3 rounded-lg font-bold text-sm transition-all active:scale-95"
              >
                Manage Plan
              </button>
            </div>
          </div>
        </section>

        {/* Usage Metrics Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Branches Used */}
          <div className="bg-surface-card border border-border-subtle p-5 rounded-xl shadow-sm">
            <p className="text-text-muted text-[13px] font-medium mb-3 font-label-md">Branches Used</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xl font-bold text-text-main font-headline-lg">{usage.branchesUsed} of {usage.branchLimit || '∞'}</span>
              {usage.branchLimit && <span className="text-xs text-text-muted">{branchesPercent.toFixed(0)}%</span>}
            </div>
            {usage.branchLimit && (
              <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-primary-container rounded-full" style={{ width: `${branchesPercent}%` }}></div>
              </div>
            )}
            {!usage.branchLimit && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">No limit</span>
            )}
          </div>

          {/* Active Staff */}
          <div className="bg-surface-card border border-border-subtle p-5 rounded-xl shadow-sm">
            <p className="text-text-muted text-[13px] font-medium mb-3 font-label-md">Active Staff</p>
            <div className="flex justify-between items-end">
              <span className="text-xl font-bold text-text-main font-headline-lg">{usage.activeStaff} {usage.staffLimit ? `of ${usage.staffLimit}` : 'of ∞'}</span>
              {usage.staffLimit ? (
                <span className="text-xs text-text-muted">{((usage.activeStaff / usage.staffLimit) * 100).toFixed(0)}%</span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">No limit</span>
              )}
            </div>
            {usage.staffLimit && (
              <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary-container rounded-full" style={{ width: `${(usage.activeStaff / usage.staffLimit) * 100}%` }}></div>
              </div>
            )}
          </div>

          {/* Orders This Month */}
          <div className="bg-surface-card border border-border-subtle p-5 rounded-xl shadow-sm">
            <p className="text-text-muted text-[13px] font-medium mb-3 font-label-md">Orders This Month</p>
            <div className="flex justify-between items-end">
              <span className="text-xl font-bold text-text-main font-headline-lg">{usage.ordersThisMonth.toLocaleString()}</span>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Unlimited</span>
            </div>
          </div>

          {/* Storage Used */}
          <div className="bg-surface-card border border-border-subtle p-5 rounded-xl shadow-sm">
            <p className="text-text-muted text-[13px] font-medium mb-3 font-label-md">Storage Used</p>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xl font-bold text-text-main font-headline-lg">{usage.storageUsedGB} GB of {usage.storageLimitGB || '∞'} GB</span>
              {usage.storageLimitGB && <span className="text-xs text-text-muted">{storagePercent.toFixed(0)}%</span>}
            </div>
            {usage.storageLimitGB && (
              <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-primary-container rounded-full" style={{ width: `${storagePercent}%` }}></div>
              </div>
            )}
          </div>
        </section>

        {/* Plans Header & Toggle */}
        <div id="available-plans" className="flex flex-col sm:flex-row justify-between items-center mb-6 scroll-mt-6">
          <h3 className="text-lg font-bold text-text-main font-headline-lg">Available Plans</h3>
          <div className="flex items-center gap-2 mt-4 sm:mt-0 p-1 bg-surface-container-low rounded-lg border border-border-subtle">
            <button 
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${billingCycle === 'MONTHLY' ? 'bg-surface-card shadow-sm text-text-main' : 'text-text-muted'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 ${billingCycle === 'ANNUAL' ? 'bg-surface-card shadow-sm text-text-main' : 'text-text-muted'}`}
            >
              Annual <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Available Plans */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {['STARTER', 'PRO', 'ENTERPRISE'].map((planKey) => {
            const isCurrent = sub.plan === planKey;
            const p = plans[planKey];
            const price = billingCycle === 'ANNUAL' ? (p.annualPrice ? p.annualPrice / 12 : null) : p.monthlyPrice;
            
            return (
              <div 
                key={planKey}
                className={`bg-surface-card flex flex-col p-8 rounded-xl ${isCurrent ? 'border-2 border-primary-container shadow-md transform scale-105 z-10 relative' : 'border border-border-subtle shadow-sm'}`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[10px] font-bold uppercase px-4 py-1 rounded-full shadow-lg whitespace-nowrap">
                    Current Plan
                  </div>
                )}
                
                <div className="mb-6">
                  <h4 className={`text-sm font-bold uppercase tracking-widest mb-1 ${planKey === 'PRO' ? 'text-primary-container' : planKey === 'ENTERPRISE' ? 'text-blue-500' : 'text-text-muted'}`}>{p.name}</h4>
                  <div className="flex items-baseline gap-1">
                    {price === null ? (
                      <span className="text-2xl font-bold font-headline-lg text-text-main">Custom Pricing</span>
                    ) : (
                      <>
                        <span className={`text-2xl font-bold font-headline-lg ${planKey === 'PRO' ? 'text-primary-container' : 'text-text-main'}`}>{formatPKR(price)}</span>
                        <span className="text-sm text-text-muted">/mo</span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {p.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-text-main">
                      <span className={`material-symbols-outlined ${planKey === 'PRO' ? 'text-emerald-500' : 'text-primary-container'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {planKey === 'ENTERPRISE' ? 'bolt' : 'check_circle'}
                      </span> 
                      {feature}
                    </li>
                  ))}
                  {planKey === 'STARTER' && (
                    <>
                      <li className="flex items-center gap-3 text-sm text-text-muted">
                        <span className="material-symbols-outlined text-surface-variant">close</span> KDS
                      </li>
                      <li className="flex items-center gap-3 text-sm text-text-muted">
                        <span className="material-symbols-outlined text-surface-variant">close</span> Integrations
                      </li>
                    </>
                  )}
                </ul>

                {isCurrent ? (
                  <button className="w-full bg-surface-container-low text-text-muted py-2.5 rounded-lg font-semibold cursor-not-allowed" disabled>
                    Current Plan
                  </button>
                ) : (
                  <button 
                    onClick={() => setSwitchingToPlan(planKey)}
                    className={`w-full py-2.5 rounded-lg font-semibold transition-colors active:scale-95 ${
                      planKey === 'ENTERPRISE' ? 'bg-primary-container hover:bg-[#E64A19] text-white' : 
                      'border border-border-subtle text-text-main hover:bg-surface-container-low'
                    }`}
                  >
                    {planKey === 'ENTERPRISE' ? 'Contact Sales' : (sub.plan === 'ENTERPRISE' || planKey === 'STARTER' ? 'Downgrade' : 'Upgrade')}
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* Bottom Row: Billing History + Payment Method */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Billing History */}
          <div className="lg:col-span-2 bg-surface-card border border-border-subtle rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center">
              <h3 className="font-bold text-text-main font-headline-lg">Billing History</h3>
              <button onClick={() => toast.info('Full billing history export is coming soon')} className="text-primary-container text-xs font-bold hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {history.map((record: any) => (
                    <tr key={record.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 text-sm text-text-main">{new Date(record.paidAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-text-main">{record.description}</td>
                      <td className="px-6 py-4 text-sm text-text-main font-semibold">{formatPKR(record.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          record.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDownloadInvoice(record.id)} className="material-symbols-outlined text-text-muted hover:text-primary-container transition-colors">download</button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-text-muted text-sm">No billing history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-surface-card border border-border-subtle rounded-xl shadow-sm p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-text-main font-headline-lg">Payment Method</h3>
              <button onClick={() => toast.info('Adding a payment method is coming soon — contact billing support for now')} className="text-primary-container text-xs font-bold hover:underline">+ Add Method</button>
            </div>

            {/* Read-only summary of the card on file — not interactive, since
                changing it requires a real payment-processor flow that
                doesn't exist yet (see "+ Add Method" above). */}
            <div className="border border-border-subtle rounded-lg p-4 mb-6 relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <span className="material-symbols-outlined text-blue-600 text-3xl">credit_card</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Primary</span>
              </div>
              <p className="text-sm font-bold text-text-main tracking-widest mb-1">•••• •••• •••• 4242</p>
              <div className="flex justify-between items-center">
                <p className="text-xs text-text-muted">Expires 12/27</p>
                <span className="text-xs font-bold uppercase text-text-muted">Visa</span>
              </div>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-4">Also Accepted</p>
            <div className="flex gap-3 mb-auto">
              <div className="h-9 px-3 rounded border border-border-subtle flex items-center justify-center grayscale bg-surface-container-low">
                <span className="text-xs font-bold text-text-muted">JazzCash</span>
              </div>
              <div className="h-9 px-3 rounded border border-border-subtle flex items-center justify-center grayscale bg-surface-container-low">
                <span className="text-xs font-bold text-text-muted">EasyPaisa</span>
              </div>
              <div className="h-9 px-3 rounded border border-border-subtle flex items-center justify-center grayscale bg-surface-container-low">
                <span className="text-xs font-bold text-text-muted">Bank Transfer</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-surface-container-low rounded-lg border border-dashed border-border-subtle text-center">
              <p className="text-xs text-text-muted">Next billing date is <span className="font-bold text-text-main">{new Date(sub.nextRenewalDate).toLocaleDateString()}</span></p>
            </div>
            <button
              onClick={() => toast.info('To cancel your subscription, contact billing support — this keeps a human in the loop on account changes')}
              className="mt-4 w-full border border-error text-error py-2 rounded-lg text-xs font-bold hover:bg-error/5 transition-colors"
            >
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {switchingToPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-card rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-2">Confirm Plan Change</h3>
            <p className="text-sm text-text-muted mb-6">
              You are about to switch to the <strong>{plans[switchingToPlan]?.name}</strong> on a <strong>{billingCycle.toLowerCase()}</strong> billing cycle.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setSwitchingToPlan(null)}
                className="px-4 py-2 border border-border-subtle rounded-lg text-sm font-semibold hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button 
                onClick={handlePlanChange}
                className="px-4 py-2 bg-primary-container text-white rounded-lg text-sm font-semibold hover:bg-opacity-90"
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminOnly>
  );
}
