'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Download,
  Plus,
  MoreVertical,
  Eye,
  Edit3,
  MessageSquare,
  Slash,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PLANS } from '@dineiz/schemas';

interface ClientItem {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: string;
  status: string;
  branchesCount: number;
  ordersThisMonth: number;
  mrr: number;
  billingCycle: string;
  joinedDate: string;
  renewalDate: string | null;
  city: string;
}

export default function AllClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedClientForEditPlan, setSelectedClientForEditPlan] = useState<ClientItem | null>(null);
  const [newPlanValue, setNewPlanValue] = useState('STARTER');
  const [selectedClientForMessage, setSelectedClientForMessage] = useState<ClientItem | null>(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBodyText, setMessageBodyText] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchClients = () => {
    setLoading(true);
    setFetchError(null);
    const query = new URLSearchParams({
      search,
      plan: planFilter,
      status: statusFilter,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });

    fetch(`/api/clients?${query.toString()}`)
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || `Failed to fetch clients (${res.status})`);
        }
        return res.json();
      })
      .then((d) => {
        if (d?.clients) setClients(d.clients);
      })
      .catch((err) => {
        console.error('Fetch clients error:', err);
        setFetchError(err.message || 'Failed to load clients');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClients();
  }, [search, planFilter, statusFilter, startDate, endDate]);

  const handleExportExcel = () => {
    const exportData = clients.map((c) => ({
      'Restaurant Name': c.name,
      'Owner Name': c.ownerName,
      'Owner Email': c.ownerEmail,
      'Owner Phone': c.ownerPhone,
      'Plan': c.plan,
      'Status': c.status,
      'Branches': c.branchesCount,
      'Orders This Month': c.ordersThisMonth,
      'MRR (PKR)': c.mrr,
      'Billing Cycle': c.billingCycle,
      'City': c.city,
      'Joined Date': new Date(c.joinedDate).toLocaleDateString(),
      'Renewal Date': c.renewalDate ? new Date(c.renewalDate).toLocaleDateString() : 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
    XLSX.writeFile(workbook, `Dineiz_Clients_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSuspend = async (client: ClientItem) => {
    if (!confirm(`Are you sure you want to suspend account for ${client.name}?`)) return;
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: client.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }),
      });
      if (res.ok) fetchClients();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (client: ClientItem) => {
    if (!confirm(`CRITICAL: Are you sure you want to PERMANENTLY DELETE client ${client.name}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete client');
      } else {
        fetchClients();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePlanChange = async () => {
    if (!selectedClientForEditPlan) return;
    try {
      const res = await fetch(`/api/clients/${selectedClientForEditPlan.id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHANGE_PLAN', plan: newPlanValue }),
      });
      if (res.ok) {
        setSelectedClientForEditPlan(null);
        fetchClients();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedClientForMessage || !messageBodyText) return;
    try {
      const res = await fetch(`/api/clients/${selectedClientForMessage.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'BOTH',
          subject: messageSubject || `Update regarding your Dineiz account`,
          messageBody: messageBodyText,
        }),
      });
      if (res.ok) {
        setSelectedClientForMessage(null);
        setMessageSubject('');
        setMessageBodyText('');
        alert('Message sent successfully!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Clients</h1>
          <p className="text-sm text-slate-500">Manage all registered restaurant tenants on Dineiz</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E63946 100%)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Add New Client</span>
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchClients}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search restaurant, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Filters controls */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-semibold"
          >
            <option value="ALL">All Plans</option>
            <option value="GO_FREE">Go Free</option>
            <option value="GO_PRO">Go Pro</option>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="TRIALING">Trialing</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Clients Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Restaurant Name</th>
                <th className="py-3.5 px-4">Owner Email</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Branches</th>
                <th className="py-3.5 px-4 text-right">Orders / Mo</th>
                <th className="py-3.5 px-4 text-right">MRR (PKR)</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-4">Renewal Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading client data...</span>
                    </div>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No clients found matching your search or filters.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <Link href={`/clients/${client.id}`} className="hover:text-orange-600 transition-colors">
                        {client.name}
                      </Link>
                      <span className="block text-[10px] text-slate-400 font-normal">{client.city}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{client.ownerEmail}</div>
                      <div className="text-[10px] text-slate-400">{client.ownerName}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                        {client.plan}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          client.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : client.status === 'TRIALING'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : client.status === 'PAST_DUE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : client.status === 'SUSPENDED'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{client.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                      {client.branchesCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                      {client.ordersThisMonth.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-orange-600">
                      PKR {client.mrr.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(client.joinedDate).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {client.renewalDate
                        ? new Date(client.renewalDate).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right relative">
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === client.id ? null : client.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdownId === client.id && (
                        <div
                          className="absolute right-4 top-10 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-left"
                          onMouseLeave={() => setOpenDropdownId(null)}
                        >
                          <Link
                            href={`/clients/${client.id}`}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Details</span>
                          </Link>
                          <button
                            onClick={() => {
                              setSelectedClientForEditPlan(client);
                              setNewPlanValue(client.plan);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-orange-600" />
                            <span>Edit Plan</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedClientForMessage(client);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Send Message</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSuspend(client);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-slate-50"
                          >
                            <Slash className="w-3.5 h-3.5" />
                            <span>{client.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend Account'}</span>
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            onClick={() => {
                              handleDelete(client);
                              setOpenDropdownId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Account</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Plan Modal */}
      {selectedClientForEditPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Plan — {selectedClientForEditPlan.name}</h3>
              <button onClick={() => setSelectedClientForEditPlan(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Select Subscription Plan</label>
              <select
                value={newPlanValue}
                onChange={(e) => setNewPlanValue(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.monthlyPrice === null ? 'Custom pricing' : p.monthlyPrice === 0 ? 'PKR 0/mo' : `PKR ${p.monthlyPrice.toLocaleString()}/mo`})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-orange-700 bg-orange-50 p-3 rounded-xl border border-orange-200">
              Note: Changing plan takes effect immediately and updates billing defaults.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedClientForEditPlan(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlanChange}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
              >
                Save Plan Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {selectedClientForMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Send Direct Message — {selectedClientForMessage.name}</h3>
              <button onClick={() => setSelectedClientForMessage(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject (for Email)</label>
                <input
                  type="text"
                  placeholder="e.g., Important account update"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={5}
                  placeholder="Write your message here..."
                  value={messageBodyText}
                  onChange={(e) => setMessageBodyText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedClientForMessage(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
