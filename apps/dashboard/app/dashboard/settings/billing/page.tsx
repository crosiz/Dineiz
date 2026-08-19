"use client";
import { formatPKR } from '@/lib/formatters';
import { useState } from 'react';
import useSWR from 'swr';
import { AdminOnly } from '@/components/admin-only';
import { apiFetch, API_URL } from '@/lib/api';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/Spinner';
import { CheckCircle2, Download, CreditCard, Zap, X, Shield, ArrowUpRight } from 'lucide-react';

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
      mutateSub();
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
        <div className="py-12 max-w-6xl mx-auto">
          <PageLoader label="Loading billing data..." />
        </div>
      </AdminOnly>
    );
  }

  const { usage } = sub;
  const branchesPercent = usage.branchLimit ? Math.min(100, (usage.branchesUsed / usage.branchLimit) * 100) : 0;
  const storagePercent = usage.storageLimitGB ? Math.min(100, (usage.storageUsedGB / usage.storageLimitGB) * 100) : 0;

  return (
    <AdminOnly>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Billing & Subscriptions</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your active organization plan, limits, and invoices</p>
          </div>
        </div>

        {/* Current Plan Overview Card */}
        <section className="w-full bg-slate-900 rounded-xl p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current Plan</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30">Active</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{sub.planName}</h2>
            <div className="flex flex-wrap gap-2 pt-1">
              {sub.features.slice(0, 5).map((feature: string, idx: number) => (
                <span key={idx} className="bg-slate-800/80 border border-slate-700/60 px-2.5 py-1 rounded-md text-xs text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-[#FF5722]" /> {feature}
                </span>
              ))}
            </div>
          </div>

          <div className="text-left md:text-right shrink-0">
            <div className="mb-4">
              {sub.plan === 'ENTERPRISE' ? (
                <span className="text-3xl font-bold tracking-tight">Custom Tier</span>
              ) : (
                <div className="flex items-baseline md:justify-end gap-1">
                  <span className="text-3xl font-bold font-mono tracking-tight">{formatPKR(sub.monthlyPrice)}</span>
                  <span className="text-sm text-slate-400">/month</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {sub.plan !== 'ENTERPRISE' && (
                <button 
                  onClick={() => setSwitchingToPlan('ENTERPRISE')}
                  className="bg-[#FF5722] hover:bg-[#F4511E] text-white px-4 py-2 rounded-lg font-medium text-xs transition-colors shadow-sm"
                >
                  Upgrade Plan
                </button>
              )}
              <button
                onClick={() => document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg font-medium text-xs transition-colors"
              >
                Compare Plans
              </button>
            </div>
          </div>
        </section>

        {/* Usage Metrics Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Branches Used */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-slate-500 text-xs font-medium mb-2">Branches Provisioned</p>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-lg font-bold text-slate-900 font-mono">{usage.branchesUsed} / {usage.branchLimit || '∞'}</span>
              {usage.branchLimit && <span className="text-xs text-slate-500">{branchesPercent.toFixed(0)}%</span>}
            </div>
            {usage.branchLimit ? (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF5722] rounded-full transition-all" style={{ width: `${branchesPercent}%` }} />
              </div>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Unlimited</span>
            )}
          </div>

          {/* Active Staff */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-slate-500 text-xs font-medium mb-2">Active Staff Seats</p>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-lg font-bold text-slate-900 font-mono">{usage.activeStaff} {usage.staffLimit ? `/ ${usage.staffLimit}` : '/ ∞'}</span>
              {usage.staffLimit ? (
                <span className="text-xs text-slate-500">{((usage.activeStaff / usage.staffLimit) * 100).toFixed(0)}%</span>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Unlimited</span>
              )}
            </div>
            {usage.staffLimit && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF5722] rounded-full transition-all" style={{ width: `${(usage.activeStaff / usage.staffLimit) * 100}%` }} />
              </div>
            )}
          </div>

          {/* Orders This Month */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-slate-500 text-xs font-medium mb-2">Orders Processed (MTD)</p>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-lg font-bold text-slate-900 font-mono">{usage.ordersThisMonth.toLocaleString()}</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Unlimited</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
          </div>

          {/* Storage Used */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <p className="text-slate-500 text-xs font-medium mb-2">Media & Cloud Storage</p>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-lg font-bold text-slate-900 font-mono">{usage.storageUsedGB} GB / {usage.storageLimitGB || '∞'} GB</span>
              {usage.storageLimitGB && <span className="text-xs text-slate-500">{storagePercent.toFixed(0)}%</span>}
            </div>
            {usage.storageLimitGB && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF5722] rounded-full transition-all" style={{ width: `${storagePercent}%` }} />
              </div>
            )}
          </div>
        </section>

        {/* Plans Header & Toggle */}
        <div id="available-plans" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-200/80">
          <div>
            <h3 className="text-base font-bold text-slate-900">Available Subscription Plans</h3>
            <p className="text-xs text-slate-500 mt-0.5">Choose the plan that fits your restaurant scale</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button 
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${billingCycle === 'MONTHLY' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${billingCycle === 'ANNUAL' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Annual <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[10px] font-bold">20% off</span>
            </button>
          </div>
        </div>

        {/* Available Plans Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {['STARTER', 'PRO', 'ENTERPRISE'].map((planKey) => {
            const isCurrent = sub.plan === planKey;
            const p = plans[planKey];
            const price = billingCycle === 'ANNUAL' ? (p.annualPrice ? p.annualPrice / 12 : null) : p.monthlyPrice;
            
            return (
              <div 
                key={planKey}
                className={`bg-white flex flex-col p-6 rounded-xl transition-all ${
                  isCurrent 
                    ? 'border-2 border-[#FF5722] shadow-sm relative' 
                    : 'border border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF5722] text-white text-[10px] font-bold uppercase px-3 py-0.5 rounded-full shadow-xs tracking-wider">
                    Current Plan
                  </div>
                )}
                
                <div className="mb-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{p.name}</h4>
                  <div className="flex items-baseline gap-1 mt-2">
                    {price === null ? (
                      <span className="text-2xl font-bold text-slate-900">Custom</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-slate-900 font-mono">{formatPKR(price)}</span>
                        <span className="text-xs text-slate-500">/mo</span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6 flex-1 text-xs">
                  {p.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2.5 text-slate-700">
                      <CheckCircle2 size={14} className="text-[#FF5722] shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {planKey === 'STARTER' && (
                    <>
                      <li className="flex items-center gap-2.5 text-slate-400">
                        <X size={14} className="text-slate-300 shrink-0" />
                        <span>KDS Kitchen Screen</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-slate-400">
                        <X size={14} className="text-slate-300 shrink-0" />
                        <span>Delivery Aggregators API</span>
                      </li>
                    </>
                  )}
                </ul>

                {isCurrent ? (
                  <button className="w-full bg-slate-100 text-slate-400 py-2 rounded-lg font-medium text-xs cursor-not-allowed" disabled>
                    Current Plan
                  </button>
                ) : (
                  <button 
                    onClick={() => setSwitchingToPlan(planKey)}
                    className={`w-full py-2 rounded-lg font-medium text-xs transition-colors ${
                      planKey === 'ENTERPRISE' 
                        ? 'bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-xs' 
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Billing History */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-sm text-slate-900">Invoices & Payment History</h3>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5">Description</th>
                    <th className="px-5 py-2.5">Amount</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((record: any) => (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 text-slate-600">{new Date(record.paidAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-slate-900 font-medium">{record.description}</td>
                      <td className="px-5 py-3 font-mono text-slate-900 font-semibold">{formatPKR(record.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          record.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDownloadInvoice(record.id)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors" title="Download PDF">
                          <Download size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">No billing history found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-slate-900">Payment Method</h3>
                <button onClick={() => toast.info('Contact billing support to update payment methods')} className="text-xs font-semibold text-[#FF5722] hover:underline">Support</button>
              </div>

              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <CreditCard size={20} className="text-slate-600" />
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Default</span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-900 tracking-wider mb-1">•••• •••• •••• 4242</p>
                <p className="text-[11px] text-slate-500">Expires 12/27 · Visa</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                <p className="text-xs text-slate-500">Next renewal: <span className="font-semibold text-slate-900">{new Date(sub.nextRenewalDate).toLocaleDateString()}</span></p>
              </div>
            </div>

            <button
              onClick={() => toast.info('To cancel your subscription, please reach out to your account manager')}
              className="mt-4 w-full border border-slate-200 text-slate-600 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Request Cancellation
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {switchingToPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Confirm Plan Change</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              You are about to switch to the <strong>{plans[switchingToPlan]?.name}</strong> on an <strong>{billingCycle.toLowerCase()}</strong> billing cycle.
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setSwitchingToPlan(null)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handlePlanChange}
                className="px-4 py-1.5 bg-[#FF5722] text-white rounded-lg text-xs font-semibold hover:bg-[#F4511E] transition-colors"
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

