'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLANS } from '@dineiz/schemas';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ToggleLeft,
  MessageSquare,
  History,
  TrendingUp,
  DollarSign,
  Users,
  Store,
  FileText,
  Plus,
  Send,
  Slash,
  RefreshCw,
  X,
  Edit3,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface TenantDetailData {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  owner: { id: string; name: string; email: string; phone: string | null } | null;
  subscription: {
    id: string;
    plan: string;
    billingCycle: string;
    status: string;
    amount: number;
    trialDays: number;
    trialEndsAt: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextRenewalDate: string;
    maxBranches: number;
    maxStaff: number;
    trialExtendedCount: number;
    gracePeriodDays: number;
    lastPaymentAt: string | null;
    lastPaymentAmount: number | null;
    lastPaymentMethod: string | null;
    cancellationReason: string | null;
  } | null;
  stats: {
    totalOrdersAllTime: number;
    ordersThisMonth: number;
    totalRevenueAllTime: number;
    revenueThisMonth: number;
    activeBranchesCount: number;
    totalStaffCount: number;
  };
  branches: {
    id: string;
    name: string;
    branchCode: string;
    city: string;
    tableCount: number;
    isActive: boolean;
    todayOrders: number;
    todayRevenue: number;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
    status: string;
    time: string;
    branchName: string;
    tableName: string;
  }[];
  featureOverrides: { featureKey: string; enabled: boolean }[];
}

export default function ClientDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const router = useRouter();

  const [data, setData] = useState<TenantDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SUBSCRIPTION' | 'PAYMENTS' | 'FEATURE_FLAGS' | 'COMMUNICATIONS' | 'ACTIVITY_LOG'>('OVERVIEW');

  // Sub-data states
  const [payments, setPayments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);

  // Modals & Action States
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState('STARTER');
  const [downgradeWarning, setDowngradeWarning] = useState<string[] | null>(null);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState('');
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [extendDays, setExtendDays] = useState('14');
  const [extendReason, setExtendReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sendMessageChannel, setSendMessageChannel] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('EMAIL');
  const [sendMessageSubject, setSendMessageSubject] = useState('');
  const [sendMessageBody, setSendMessageBody] = useState('');
  const [savingFeatures, setSavingFeatures] = useState(false);

  const fetchClientData = () => {
    setLoading(true);
    fetch(`/api/clients/${tenantId}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Failed to fetch client detail (${res.status})`);
        }
        return res.json();
      })
      .then((d) => {
        if (d?.tenant) {
          setData(d.tenant);
          if (d.tenant.subscription) setNewPlan(d.tenant.subscription.plan);
        }
      })
      .catch((err) => {
        console.error('Fetch client detail error:', err);
      })
      .finally(() => setLoading(false));
  };

  const fetchPayments = () => {
    fetch(`/api/clients/${tenantId}/payments`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.payments) setPayments(d.payments);
      });
  };

  const fetchMessages = () => {
    fetch(`/api/clients/${tenantId}/messages`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.messages) setMessages(d.messages);
      });
  };

  const fetchAuditLogs = () => {
    fetch(`/api/system/audit-trail?tenantId=${tenantId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.logs) setAuditLogs(d.logs);
      });
  };

  const fetchFeatureFlags = () => {
    fetch(`/api/clients/${tenantId}/features`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.features) setFeatureFlags(d.features);
      });
  };

  useEffect(() => {
    fetchClientData();
  }, [tenantId]);

  useEffect(() => {
    if (activeTab === 'PAYMENTS') fetchPayments();
    if (activeTab === 'COMMUNICATIONS') fetchMessages();
    if (activeTab === 'ACTIVITY_LOG') fetchAuditLogs();
    if (activeTab === 'FEATURE_FLAGS') fetchFeatureFlags();
  }, [activeTab]);

  const handleBranchToggle = async (branchId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/clients/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchToggleId: branchId, branchIsActive: !currentStatus }),
      });
      if (res.ok) fetchClientData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubscriptionAction = async (action: string, payload?: any) => {
    try {
      const res = await fetch(`/api/clients/${tenantId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.status === 409 && resData.error === 'DOWNGRADE_EXCEEDS_USAGE') {
        setDowngradeWarning(resData.exceeds || []);
        return;
      }
      if (res.ok) {
        setShowChangePlanModal(false);
        setShowExtendTrialModal(false);
        setShowCancelModal(false);
        setDowngradeWarning(null);
        setExtendReason('');
        setCancellationReason('');
        fetchClientData();
      } else {
        alert(resData.error || resData.message || 'Action failed');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${tenantId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          reference: paymentRef,
          notes: paymentNotes,
          method: paymentMethod,
          periodEnd: paymentPeriodEnd || undefined,
        }),
      });
      if (res.ok) {
        setShowManualPaymentModal(false);
        setPaymentAmount('');
        setPaymentRef('');
        setPaymentNotes('');
        setPaymentPeriodEnd('');
        fetchPayments();
        fetchClientData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveFeatureOverrides = async () => {
    setSavingFeatures(true);
    try {
      const payload = featureFlags.map((f) => ({
        featureKey: f.key,
        overrideStatus: f.overrideStatus,
      }));

      const res = await fetch(`/api/clients/${tenantId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: payload }),
      });
      if (res.ok) {
        alert('Feature overrides saved successfully!');
        fetchFeatureFlags();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleSendSingleMessage = async () => {
    if (!sendMessageBody) return;
    try {
      const res = await fetch(`/api/clients/${tenantId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: sendMessageChannel,
          subject: sendMessageSubject,
          messageBody: sendMessageBody,
        }),
      });
      if (res.ok) {
        setSendMessageSubject('');
        setSendMessageBody('');
        fetchMessages();
        alert('Message sent successfully!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const applyTemplate = (template: string) => {
    if (template === 'RENEWAL') {
      setSendMessageSubject(`Upcoming Subscription Renewal Notice — ${data?.name}`);
      setSendMessageBody(`Salam ${data?.owner?.name}! Aapki Dineiz subscription renew hone waali hai. Kindly payment karein taakay POS services uninterrupted chalti rahein. Shukriya!`);
    } else if (template === 'TRIAL') {
      setSendMessageSubject(`Your Dineiz Trial is Ending Soon — ${data?.name}`);
      setSendMessageBody(`Hi ${data?.owner?.name}, Your 14-day free trial on Dineiz is expiring. Upgrade your account today to maintain full POS access.`);
    } else if (template === 'WELCOME') {
      setSendMessageSubject(`Welcome to Dineiz Platform — Getting Started`);
      setSendMessageBody(`Welcome ${data?.owner?.name}! Thank you for joining Dineiz. Your POS access and admin console URL is console.dineiz.com. Let us know if you need onboard assistance.`);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400">
        Client record not found.
      </div>
    );
  }

  const sub = data.subscription;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{data.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  {sub?.plan || 'STARTER'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  data.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : data.status === 'TRIALING'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {data.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Owner: <strong className="text-slate-700">{data.owner?.name || 'N/A'}</strong> ({data.owner?.email || 'N/A'}) • {data.owner?.phone || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchClientData}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href={`https://${data.domain || 'console.dineiz.com'}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Visit Console</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-100 pb-2 custom-scrollbar">
          {[
            { key: 'OVERVIEW', label: 'OVERVIEW', icon: TrendingUp },
            { key: 'SUBSCRIPTION', label: 'SUBSCRIPTION', icon: CreditCard },
            { key: 'PAYMENTS', label: 'PAYMENTS', icon: DollarSign },
            { key: 'FEATURE_FLAGS', label: 'FEATURE FLAGS', icon: ToggleLeft },
            { key: 'COMMUNICATIONS', label: 'COMMUNICATIONS', icon: MessageSquare },
            { key: 'ACTIVITY_LOG', label: 'ACTIVITY LOG', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-orange-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Orders All Time</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{data.stats.totalOrdersAllTime.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Orders This Month</span>
              <span className="text-xl font-extrabold text-orange-600 mt-1 block">{data.stats.ordersThisMonth.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Revenue All Time</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">PKR {data.stats.totalRevenueAllTime.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Revenue This Month</span>
              <span className="text-xl font-extrabold text-emerald-600 mt-1 block">PKR {data.stats.revenueThisMonth.toLocaleString()}</span>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Branches</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{data.stats.activeBranchesCount}</span>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Staff Users</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{data.stats.totalStaffCount}</span>
            </div>
          </div>

          {/* Branch List */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">Branches List</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="pb-3">Branch Name</th>
                    <th className="pb-3">Branch Code</th>
                    <th className="pb-3">City</th>
                    <th className="pb-3 text-center">Tables Count</th>
                    <th className="pb-3 text-right">Status Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {data.branches.map((b) => (
                    <tr key={b.id}>
                      <td className="py-3 font-bold text-slate-900">{b.name}</td>
                      <td className="py-3 font-mono text-orange-600">{b.branchCode}</td>
                      <td className="py-3 text-slate-500">{b.city}</td>
                      <td className="py-3 text-center font-semibold">{b.tableCount}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleBranchToggle(b.id, b.isActive)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders Activity */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-wide">Recent Orders (Last 10)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-3">Order #</th>
                    <th className="pb-3">Branch</th>
                    <th className="pb-3">Table / Type</th>
                    <th className="pb-3">Payment</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 font-mono font-bold text-orange-600">#{o.orderNumber}</td>
                      <td className="py-3 font-semibold text-slate-900">{o.branchName}</td>
                      <td className="py-3 text-slate-500">{o.tableName}</td>
                      <td className="py-3 text-slate-600">{o.paymentMethod}</td>
                      <td className="py-3 font-bold text-slate-900">PKR {o.total.toLocaleString()}</td>
                      <td className="py-3 text-slate-500">{new Date(o.time).toLocaleString()}</td>
                    </tr>
                  ))}
                  {data.recentOrders.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-400">No orders recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION */}
      {activeTab === 'SUBSCRIPTION' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Subscription Plan</span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold text-orange-600">{sub?.plan || 'STARTER'}</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {sub?.billingCycle || 'MONTHLY'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChangePlanModal(true)}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm"
                >
                  Change Plan
                </button>
                <button
                  onClick={() => handleSubscriptionAction('TOGGLE_CYCLE')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                >
                  Toggle Annual / Monthly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Subscription Status</span>
                <span className="font-bold text-emerald-600 text-sm mt-1 block">{sub?.status || 'ACTIVE'}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Next Renewal Amount</span>
                <span className="font-bold text-slate-900 text-sm mt-1 block">PKR {(sub?.amount || 8000).toLocaleString()}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Current Period Start</span>
                <span className="font-bold text-slate-600 text-sm mt-1 block">
                  {sub?.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-slate-400 block">Next Renewal Date</span>
                <span className="font-bold text-orange-600 text-sm mt-1 block">
                  {sub?.nextRenewalDate ? new Date(sub.nextRenewalDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Usage against plan limits */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Usage Against Limits</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">Branches</span>
                    <span className="font-bold text-slate-900">
                      {data.stats.activeBranchesCount} of {sub?.maxBranches === -1 ? 'Unlimited' : sub?.maxBranches ?? '—'}
                    </span>
                  </div>
                  {sub && sub.maxBranches !== -1 && (
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.stats.activeBranchesCount >= sub.maxBranches ? 'bg-rose-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100, (data.stats.activeBranchesCount / Math.max(1, sub.maxBranches)) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-slate-400">Staff</span>
                    <span className="font-bold text-slate-900">
                      {data.stats.totalStaffCount} of {sub?.maxStaff === -1 ? 'Unlimited' : sub?.maxStaff ?? '—'}
                    </span>
                  </div>
                  {sub && sub.maxStaff !== -1 && (
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${data.stats.totalStaffCount >= sub.maxStaff ? 'bg-rose-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100, (data.stats.totalStaffCount / Math.max(1, sub.maxStaff)) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {downgradeWarning && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-700 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-700">
                  <AlertTriangle className="w-4 h-4" /> This plan change exceeds current usage
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {downgradeWarning.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
                <button
                  onClick={() => handleSubscriptionAction('CHANGE_PLAN', { plan: newPlan, acknowledgeDowngrade: true })}
                  className="mt-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Proceed anyway
                </button>
                <button
                  onClick={() => setDowngradeWarning(null)}
                  className="ml-2 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Trial Management & Status Controls */}
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Trial & Status Controls</h4>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowExtendTrialModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold"
                >
                  Extend Trial{sub?.trialExtendedCount ? ` (extended ${sub.trialExtendedCount}×)` : ''}
                </button>
                <button
                  onClick={() => handleSubscriptionAction('END_TRIAL_EARLY')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
                >
                  End Trial Early & Activate
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'ACTIVE' })}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'PAST_DUE' })}
                  className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold"
                >
                  Set Past Due
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'SUSPENDED' })}
                  className="px-3.5 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 text-xs font-semibold"
                >
                  Suspend
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold"
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Payment History</h3>
            <button
              onClick={() => setShowManualPaymentModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manual Payment</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Reference #</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3.5 px-4 text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">PKR {p.amount.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-orange-600">{p.method}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{p.reference || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-orange-600 hover:underline flex items-center gap-1 ml-auto">
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF Invoice</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">No payment records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FEATURE FLAGS */}
      {activeTab === 'FEATURE_FLAGS' && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tenant Feature Overrides</h3>
              <p className="text-xs text-slate-500">Override system feature access specifically for {data.name}</p>
            </div>
            <button
              onClick={handleSaveFeatureOverrides}
              disabled={savingFeatures}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
            >
              {savingFeatures ? 'Saving...' : 'Save Feature Overrides'}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="divide-y divide-slate-100">
              {featureFlags.map((flag, idx) => (
                <div key={flag.key} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{flag.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                        Requires: {flag.minimumPlan}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{flag.description}</p>
                  </div>

                  <select
                    value={flag.overrideStatus}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFeatureFlags((prev) =>
                        prev.map((f) => (f.key === flag.key ? { ...f, overrideStatus: val } : f))
                      );
                    }}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="FOLLOWING_PLAN">Follow Plan Default ({flag.planDefaultAccess ? 'Enabled' : 'Disabled'})</option>
                    <option value="ENABLED">Override: ENABLED</option>
                    <option value="DISABLED">Override: DISABLED</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: COMMUNICATIONS */}
      {activeTab === 'COMMUNICATIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Direct Message Composer */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Compose Message</h3>

            {/* Quick Templates */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Quick Templates</span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => applyTemplate('RENEWAL')} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[11px] text-orange-600 rounded-lg border border-slate-200">
                  Renewal Reminder
                </button>
                <button onClick={() => applyTemplate('TRIAL')} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[11px] text-blue-600 rounded-lg border border-slate-200">
                  Trial Ending
                </button>
                <button onClick={() => applyTemplate('WELCOME')} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-[11px] text-emerald-600 rounded-lg border border-slate-200">
                  Welcome Onboarding
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Channel</label>
                <select
                  value={sendMessageChannel}
                  onChange={(e) => setSendMessageChannel(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="EMAIL">Email Only</option>
                  <option value="WHATSAPP">WhatsApp Only</option>
                  <option value="BOTH">Both Email & WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendMessageSubject}
                  onChange={(e) => setSendMessageSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Message Body</label>
                <textarea
                  rows={5}
                  value={sendMessageBody}
                  onChange={(e) => setSendMessageBody(e.target.value)}
                  placeholder="Write message..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <button
                onClick={handleSendSingleMessage}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </div>
          </div>

          {/* Right Column: Message History */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Client Message History</h3>
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-orange-600">{m.channel} Message</span>
                    <span className="text-slate-400">{new Date(m.sentAt).toLocaleString()}</span>
                  </div>
                  {m.subject && <div className="text-xs font-semibold text-slate-900">{m.subject}</div>}
                  <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">{m.body}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No messages sent yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ACTIVITY LOG (AUDIT) */}
      {activeTab === 'ACTIVITY_LOG' && (
        <div className="space-y-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Client Audit & Activity Trail</h3>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-orange-600 mr-2">[{log.action}]</span>
                  <span className="text-slate-700">{log.notes || 'Action performed'}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <span>{log.superAdmin?.name || 'System'}</span> • <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-xs text-slate-400 text-center py-8">No audit logs recorded for this tenant.</p>}
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Change Subscription Plan</h3>
              <button onClick={() => setShowChangePlanModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Plan</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.monthlyPrice === null ? 'Custom pricing' : p.monthlyPrice === 0 ? 'PKR 0/mo' : `PKR ${p.monthlyPrice.toLocaleString()}/mo`})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setShowChangePlanModal(false); setDowngradeWarning(null); }} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              <button
                onClick={() => handleSubscriptionAction('CHANGE_PLAN', { plan: newPlan })}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl"
              >
                Confirm Plan Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {showExtendTrialModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Extend Trial</h3>
              <button onClick={() => setShowExtendTrialModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Extend by (days)</label>
                <div className="flex gap-2">
                  {['7', '14', '30'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtendDays(d)}
                      className={`px-3 py-1.5 rounded-lg font-semibold ${extendDays === d ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {d}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                    className="w-20 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-center"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason <span className="text-orange-500">*</span></label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Owner requested more time to train staff"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowExtendTrialModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              <button
                onClick={() => handleSubscriptionAction('EXTEND_TRIAL', { extendDays: Number(extendDays), extendReason })}
                disabled={!extendReason.trim()}
                className="px-4 py-2 bg-blue-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                Extend Trial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Cancel Subscription</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs">
              <label className="block text-slate-700 font-semibold mb-1">Reason</label>
              <textarea
                rows={2}
                placeholder="e.g. Owner closed the restaurant"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Back</button>
              <button
                onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'CANCELLED', cancellationReason })}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showManualPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddManualPayment} className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Manual Bank Payment</h3>
              <button type="button" onClick={() => setShowManualPaymentModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. HBL-FT-991823 or TXN-887234"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Period Covers Until</label>
                <input
                  type="date"
                  value={paymentPeriodEnd}
                  onChange={(e) => setPaymentPeriodEnd(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
                <span className="text-[10px] text-slate-400 block mt-1">Leave blank to auto-extend by one billing cycle.</span>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual renewal paid via cheque"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowManualPaymentModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl">
                Record Payment & Extend
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
