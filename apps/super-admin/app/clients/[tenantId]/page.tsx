'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [sendMessageChannel, setSendMessageChannel] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('EMAIL');
  const [sendMessageSubject, setSendMessageSubject] = useState('');
  const [sendMessageBody, setSendMessageBody] = useState('');
  const [savingFeatures, setSavingFeatures] = useState(false);

  const fetchClientData = () => {
    setLoading(true);
    fetch(`/api/clients/${tenantId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.tenant) {
          setData(d.tenant);
          if (d.tenant.subscription) setNewPlan(d.tenant.subscription.plan);
        }
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
      if (res.ok) {
        setShowChangePlanModal(false);
        fetchClientData();
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
          method: 'BANK_TRANSFER',
        }),
      });
      if (res.ok) {
        setShowManualPaymentModal(false);
        setPaymentAmount('');
        setPaymentRef('');
        setPaymentNotes('');
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
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
      <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <Link href="/clients" className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">{data.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {sub?.plan || 'STARTER'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  data.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : data.status === 'TRIALING'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {data.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Owner: <strong className="text-slate-200">{data.owner?.name || 'N/A'}</strong> ({data.owner?.email || 'N/A'}) • {data.owner?.phone || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchClientData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href={`https://${data.domain || 'console.dineiz.com'}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Visit Console</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-800/80 pb-2 custom-scrollbar">
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
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
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
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Orders All Time</span>
              <span className="text-xl font-extrabold text-white mt-1 block">{data.stats.totalOrdersAllTime.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Orders This Month</span>
              <span className="text-xl font-extrabold text-amber-400 mt-1 block">{data.stats.ordersThisMonth.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Revenue All Time</span>
              <span className="text-xl font-extrabold text-white mt-1 block">PKR {data.stats.totalRevenueAllTime.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Revenue This Month</span>
              <span className="text-xl font-extrabold text-emerald-400 mt-1 block">PKR {data.stats.revenueThisMonth.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Branches</span>
              <span className="text-xl font-extrabold text-white mt-1 block">{data.stats.activeBranchesCount}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Staff Users</span>
              <span className="text-xl font-extrabold text-white mt-1 block">{data.stats.totalStaffCount}</span>
            </div>
          </div>

          {/* Branch List */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Branches List</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="pb-3">Branch Name</th>
                    <th className="pb-3">Branch Code</th>
                    <th className="pb-3">City</th>
                    <th className="pb-3 text-center">Tables Count</th>
                    <th className="pb-3 text-right">Status Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.branches.map((b) => (
                    <tr key={b.id}>
                      <td className="py-3 font-bold text-white">{b.name}</td>
                      <td className="py-3 font-mono text-amber-400">{b.branchCode}</td>
                      <td className="py-3 text-slate-400">{b.city}</td>
                      <td className="py-3 text-center font-semibold">{b.tableCount}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleBranchToggle(b.id, b.isActive)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                            b.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Recent Orders (Last 10)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="pb-3">Order #</th>
                    <th className="pb-3">Branch</th>
                    <th className="pb-3">Table / Type</th>
                    <th className="pb-3">Payment</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-3 font-mono font-bold text-amber-400">#{o.orderNumber}</td>
                      <td className="py-3 font-semibold text-white">{o.branchName}</td>
                      <td className="py-3 text-slate-400">{o.tableName}</td>
                      <td className="py-3 text-slate-300">{o.paymentMethod}</td>
                      <td className="py-3 font-bold text-white">PKR {o.total.toLocaleString()}</td>
                      <td className="py-3 text-slate-400">{new Date(o.time).toLocaleString()}</td>
                    </tr>
                  ))}
                  {data.recentOrders.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-slate-500">No orders recorded yet.</td></tr>
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
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Subscription Plan</span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold text-amber-400">{sub?.plan || 'STARTER'}</h2>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                    {sub?.billingCycle || 'MONTHLY'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowChangePlanModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  Change Plan
                </button>
                <button
                  onClick={() => handleSubscriptionAction('TOGGLE_CYCLE')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  Toggle Annual / Monthly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Subscription Status</span>
                <span className="font-bold text-emerald-400 text-sm mt-1 block">{sub?.status || 'ACTIVE'}</span>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Next Renewal Amount</span>
                <span className="font-bold text-white text-sm mt-1 block">PKR {(sub?.amount || 8000).toLocaleString()}</span>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Current Period Start</span>
                <span className="font-bold text-slate-300 text-sm mt-1 block">
                  {sub?.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Next Renewal Date</span>
                <span className="font-bold text-amber-400 text-sm mt-1 block">
                  {sub?.nextRenewalDate ? new Date(sub.nextRenewalDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            {/* Trial Management & Status Controls */}
            <div className="space-y-4 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Trial & Status Controls</h4>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleSubscriptionAction('EXTEND_TRIAL', { extendDays: 7 })}
                  className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold"
                >
                  Extend Trial (+7 Days)
                </button>
                <button
                  onClick={() => handleSubscriptionAction('END_TRIAL_EARLY')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                >
                  End Trial Early & Activate
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'ACTIVE' })}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'PAST_DUE' })}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold"
                >
                  Set Past Due
                </button>
                <button
                  onClick={() => handleSubscriptionAction('UPDATE_STATUS', { newStatus: 'CANCELLED' })}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold"
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
            <h3 className="text-base font-bold text-white">Payment History</h3>
            <button
              onClick={() => setShowManualPaymentModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manual Payment</span>
            </button>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Method</th>
                  <th className="py-3.5 px-4">Reference #</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3.5 px-4 text-slate-400">{new Date(p.paidAt).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4 font-bold text-white">PKR {p.amount.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-amber-400">{p.method}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{p.reference || 'N/A'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="text-amber-500 hover:underline flex items-center gap-1 ml-auto">
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF Invoice</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">No payment records found.</td></tr>
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
              <h3 className="text-base font-bold text-white">Tenant Feature Overrides</h3>
              <p className="text-xs text-slate-400">Override system feature access specifically for {data.name}</p>
            </div>
            <button
              onClick={handleSaveFeatureOverrides}
              disabled={savingFeatures}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              {savingFeatures ? 'Saving...' : 'Save Feature Overrides'}
            </button>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl p-6 space-y-4">
            <div className="divide-y divide-slate-800">
              {featureFlags.map((flag, idx) => (
                <div key={flag.key} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{flag.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded">
                        Requires: {flag.minimumPlan}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{flag.description}</p>
                  </div>

                  <select
                    value={flag.overrideStatus}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFeatureFlags((prev) =>
                        prev.map((f) => (f.key === flag.key ? { ...f, overrideStatus: val } : f))
                      );
                    }}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
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
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Compose Message</h3>

            {/* Quick Templates */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Quick Templates</span>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => applyTemplate('RENEWAL')} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[11px] text-amber-400 rounded-lg border border-slate-800">
                  Renewal Reminder
                </button>
                <button onClick={() => applyTemplate('TRIAL')} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[11px] text-blue-400 rounded-lg border border-slate-800">
                  Trial Ending
                </button>
                <button onClick={() => applyTemplate('WELCOME')} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[11px] text-emerald-400 rounded-lg border border-slate-800">
                  Welcome Onboarding
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Channel</label>
                <select
                  value={sendMessageChannel}
                  onChange={(e) => setSendMessageChannel(e.target.value as any)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="EMAIL">Email Only</option>
                  <option value="WHATSAPP">WhatsApp Only</option>
                  <option value="BOTH">Both Email & WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendMessageSubject}
                  onChange={(e) => setSendMessageSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Message Body</label>
                <textarea
                  rows={5}
                  value={sendMessageBody}
                  onChange={(e) => setSendMessageBody(e.target.value)}
                  placeholder="Write message..."
                  className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <button
                onClick={handleSendSingleMessage}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </div>
          </div>

          {/* Right Column: Message History */}
          <div className="lg:col-span-2 bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">Client Message History</h3>
            <div className="space-y-3">
              {messages.map((m) => (
                <div key={m.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">{m.channel} Message</span>
                    <span className="text-slate-400">{new Date(m.sentAt).toLocaleString()}</span>
                  </div>
                  {m.subject && <div className="text-xs font-semibold text-white">{m.subject}</div>}
                  <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/50">{m.body}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="text-xs text-slate-500 text-center py-8">No messages sent yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ACTIVITY LOG (AUDIT) */}
      {activeTab === 'ACTIVITY_LOG' && (
        <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 p-6 rounded-2xl shadow-xl">
          <h3 className="text-sm font-bold text-white">Client Audit & Activity Trail</h3>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-amber-400 mr-2">[{log.action}]</span>
                  <span className="text-slate-200">{log.notes || 'Action performed'}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  <span>{log.superAdmin?.name || 'System'}</span> • <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-xs text-slate-500 text-center py-8">No audit logs recorded for this tenant.</p>}
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Change Subscription Plan</h3>
              <button onClick={() => setShowChangePlanModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select New Plan</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="FREE">Free Go (PKR 0/mo)</option>
                <option value="PRO_GO">Pro Go (PKR 12,000/mo)</option>
                <option value="STARTER">Starter (PKR 8,000/mo)</option>
                <option value="PRO">Pro (PKR 15,000/mo)</option>
                <option value="ENTERPRISE">Enterprise (PKR 35,000/mo)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowChangePlanModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button
                onClick={() => handleSubscriptionAction('CHANGE_PLAN', { plan: newPlan })}
                className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
              >
                Confirm Plan Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showManualPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddManualPayment} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add Manual Bank Payment</h3>
              <button type="button" onClick={() => setShowManualPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Bank Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. HBL-FT-991823"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual renewal paid via cheque"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowManualPaymentModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl">
                Record Payment & Extend
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
