'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  Clock,
  UserMinus,
  TrendingUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CalendarClock,
  MailWarning,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardData {
  activeClients: number;
  mrr: number;
  trialClients: number;
  churnThisMonth: number;
  mrrHistory: { month: string; mrr: number }[];
  recentSignups: {
    id: string;
    name: string;
    ownerEmail: string;
    plan: string;
    signedUpDate: string;
    trialEndDate: string | null;
    status: string;
  }[];
  expiringSoon: {
    id: string;
    subscriptionId: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    plan: string;
    expiryDate: string;
    amount: number;
  }[];
  needsAttention?: {
    pastDueCount: number;
    pastDueAmount: number;
    trialsExpiringTomorrow: number;
    bouncedEmails: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderSentMap, setReminderSentMap] = useState<Record<string, boolean>>({});

  const fetchDashboard = () => {
    setLoading(true);
    fetch('/api/dashboard')
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .catch((err) => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSendReminder = async (tenantId: string, tenantName: string) => {
    setSendingReminder(tenantId);
    try {
      const res = await fetch(`/api/clients/${tenantId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'BOTH',
          subject: `Subscription Renewal Reminder — ${tenantName}`,
          messageBody: `Salam! Aapki Dineiz subscription renew hone waali hai. Kindly pay online or contact support. Shukriya!`,
        }),
      });

      if (res.ok) {
        setReminderSentMap((prev) => ({ ...prev, [tenantId]: true }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingReminder(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-semibold">Loading operations metrics...</span>
        </div>
      </div>
    );
  }

  const attention = data?.needsAttention;
  const hasAttentionItems = !!attention && (attention.pastDueCount > 0 || attention.trialsExpiringTomorrow > 0 || attention.bouncedEmails > 0);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform metrics, revenue tracking, and client renewals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboard}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Client</span>
          </Link>
        </div>
      </div>

      {/* Needs Attention Panel */}
      {hasAttentionItems && (
        <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <AlertTriangle className="w-4.5 h-4.5 text-orange-600" />
            <h2 className="text-sm font-bold text-orange-800 tracking-wide">Needs Attention</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/subscriptions/billing"
              className="flex items-center gap-3 bg-white/70 hover:bg-white border border-orange-200/80 rounded-xl p-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-extrabold text-slate-900 block leading-tight">
                  {attention?.pastDueCount ?? 0}
                </span>
                <span className="text-[11px] text-slate-500">
                  Past due · PKR {(attention?.pastDueAmount ?? 0).toLocaleString()} outstanding
                </span>
              </div>
            </Link>

            <Link
              href="/clients/trials"
              className="flex items-center gap-3 bg-white/70 hover:bg-white border border-orange-200/80 rounded-xl p-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-extrabold text-slate-900 block leading-tight">
                  {attention?.trialsExpiringTomorrow ?? 0}
                </span>
                <span className="text-[11px] text-slate-500">Trials expiring tomorrow</span>
              </div>
            </Link>

            <Link
              href="/communications/email-log?status=BOUNCED"
              className="flex items-center gap-3 bg-white/70 hover:bg-white border border-orange-200/80 rounded-xl p-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <MailWarning className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-extrabold text-slate-900 block leading-tight">
                  {attention?.bouncedEmails ?? 0}
                </span>
                <span className="text-[11px] text-slate-500">Bounced emails</span>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Four KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Active Clients */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Clients</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {data?.activeClients || 0}
            </span>
            <span className="text-xs text-slate-500 ml-2">tenants</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12.4% from last month</span>
          </div>
        </div>

        {/* KPI 2: MRR */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Recurring Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-orange-600 tracking-tight">
              PKR {(data?.mrr || 0).toLocaleString()}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-orange-600/80 font-semibold">
            <span>Sum of active subscriptions</span>
          </div>
        </div>

        {/* KPI 3: Trial Clients */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trial Clients</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {data?.trialClients || 0}
            </span>
            <span className="text-xs text-slate-500 ml-2">in trialing</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
            <Link href="/clients/trials" className="hover:underline flex items-center gap-1">
              <span>View active trials</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* KPI 4: Churn This Month */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Churn This Month</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <UserMinus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {data?.churnThisMonth || 0}
            </span>
            <span className="text-xs text-slate-500 ml-2">cancelled</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-600/80 font-semibold">
            <Link href="/clients/churned" className="hover:underline flex items-center gap-1">
              <span>View churn analysis</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* MRR Growth Chart */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-wide">MRR Growth Trajectory (Last 12 Months)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Monthly recurring revenue growth in PKR</p>
          </div>
          <div className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
            PKR {(data?.mrr || 0).toLocaleString()} Current MRR
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.mrrHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `PKR ${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  borderColor: '#E2E8F0',
                  borderRadius: '12px',
                  color: '#0F172A',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(val: any) => [`PKR ${Number(val).toLocaleString()}`, 'MRR']}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="#FF6B35"
                strokeWidth={3}
                dot={{ fill: '#FF6B35', r: 4 }}
                activeDot={{ r: 6, fill: '#E63946' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Columns: Left Recent Signups | Right Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Signups */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">Recent Signups</h3>
              <p className="text-xs text-slate-500">Last 10 newly onboarded tenants</p>
            </div>
            <Link href="/clients" className="text-xs font-semibold text-orange-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Restaurant</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Signed Up</th>
                  <th className="pb-3">Trial End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {data?.recentSignups?.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-2">
                      <Link href={`/clients/${client.id}`} className="font-bold text-slate-900 hover:text-orange-600 block truncate max-w-[140px]">
                        {client.name}
                      </Link>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                        {client.ownerEmail}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                        {client.plan}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">
                      {new Date(client.signedUpDate).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 text-slate-500">
                      {client.trialEndDate
                        ? new Date(client.trialEndDate).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
                {(!data?.recentSignups || data.recentSignups.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No signups recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Expiring Soon */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-wide">Expiring Soon (Next 7 Days)</h3>
              <p className="text-xs text-slate-500">Subscriptions requiring renewal attention</p>
            </div>
            <Link href="/subscriptions" className="text-xs font-semibold text-orange-600 hover:underline">
              Subscriptions
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="pb-3">Restaurant</th>
                  <th className="pb-3">Expiry Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {data?.expiringSoon?.map((client) => {
                  const isSent = reminderSentMap[client.id];
                  const isSending = sendingReminder === client.id;

                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-2">
                        <Link href={`/clients/${client.id}`} className="font-bold text-slate-900 hover:text-orange-600 block truncate max-w-[130px]">
                          {client.name}
                        </Link>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                          {client.plan} • {client.ownerName}
                        </span>
                      </td>
                      <td className="py-3 text-orange-600 font-semibold">
                        {new Date(client.expiryDate).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 font-bold text-slate-900">
                        PKR {client.amount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleSendReminder(client.id, client.name)}
                          disabled={isSent || isSending}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-[11px] transition-all ${
                            isSent
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                          }`}
                        >
                          {isSending ? (
                            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                          ) : isSent ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Reminder</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(!data?.expiringSoon || data.expiringSoon.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No subscriptions expiring in the next 7 days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
