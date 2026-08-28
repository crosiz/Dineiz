'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Webhook, Plus, Edit2, Trash2, Activity, ShieldCheck, RefreshCw, X, Play, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { SkeletonTable, SkeletonList } from '@/components/ui/skeleton';

const EVENTS = [
  { id: 'order.created', label: 'Order Created', category: 'Orders' },
  { id: 'order.sent_to_kitchen', label: 'Order Sent to Kitchen', category: 'Orders' },
  { id: 'order.marked_ready', label: 'Order Marked Ready', category: 'Orders' },
  { id: 'order.completed', label: 'Order Completed', category: 'Orders' },
  { id: 'order.cancelled', label: 'Order Cancelled', category: 'Orders' },
  { id: 'payment.collected', label: 'Payment Collected', category: 'Payments' },
  { id: 'payment.refunded', label: 'Payment Refunded', category: 'Payments' },
  { id: 'customer.created', label: 'Customer Created', category: 'Customers' },
  { id: 'customer.updated', label: 'Customer Updated', category: 'Customers' },
  { id: 'loyalty.points_earned', label: 'Points Earned', category: 'Loyalty' },
  { id: 'loyalty.tier_changed', label: 'Tier Changed', category: 'Loyalty' },
  { id: 'shift.opened', label: 'Shift Opened', category: 'Staff' },
  { id: 'shift.closed', label: 'Shift Closed', category: 'Staff' },
  { id: 'menu.item_updated', label: 'Menu Item Updated', category: 'Menu' },
  { id: 'menu.published', label: 'Menu Published', category: 'Menu' },
  { id: 'stock.low_alert', label: 'Stock Low Alert', category: 'Inventory' },
  { id: 'stock.purchase_order_created', label: 'PO Created', category: 'Inventory' },
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { branchId, queryParam } = useBranchFilter();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks', branchId],
    queryFn: () => apiFetch<any[]>(`/api/webhooks${queryParam ? `?${queryParam}` : ''}`)
  });

  const generateSecret = () => {
    return 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleOpenNew = () => {
    setEditingWebhook({
      url: '',
      secret: generateSecret(),
      events: [],
      isActive: true
    });
    setIsSlideOverOpen(true);
  };

  const handleEdit = (webhook: any) => {
    setEditingWebhook({
      ...webhook,
      events: typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events
    });
    setIsSlideOverOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) return apiFetch(`/api/webhooks/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      return apiFetch('/api/webhooks', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setIsSlideOverOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] })
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Webhook className="text-brand-primary" /> Webhooks
            </h1>
            <p className="text-slate-500 mt-1">Receive real-time events in your external systems.</p>
          </div>
          
          <button 
            onClick={handleOpenNew}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-orange-600 transition-colors"
          >
            <Plus size={18} /> Add Webhook
          </button>
        </div>

        {/* Webhooks List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <SkeletonTable
              className="border-0 shadow-none rounded-none"
              rows={5}
              columns={[220, { w: 72, pill: true }, { w: 60, pill: true }, 96, 100, { w: 72, align: 'right' }]}
            />
          ) : webhooks.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Webhook className="text-brand-primary" size={32} />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">No Webhooks Configured</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">Connect your external systems by subscribing to real-time events across your restaurant operations.</p>
              <button 
                onClick={handleOpenNew}
                className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg font-bold hover:bg-slate-200 transition-colors"
              >
                Create your first webhook
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Endpoint URL</th>
                    <th className="p-4">Events</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Success Rate</th>
                    <th className="p-4">Last Triggered</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {webhooks.map((wh) => (
                    <React.Fragment key={wh.id}>
                      <tr className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 max-w-[250px] truncate" title={wh.url}>{wh.url}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <ShieldCheck size={12} /> HMAC-SHA256
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                            {(() => {
                              try {
                                return JSON.parse(wh.events).length;
                              } catch { return 0; }
                            })()} subscribed
                          </div>
                        </td>
                        <td className="p-4">
                          {wh.status === 'ACTIVE' && <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-bold"><CheckCircle2 size={12}/> Active</span>}
                          {wh.status === 'FAILING' && <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold"><RefreshCw size={12}/> Failing ({wh.failureCount}/50)</span>}
                          {wh.status === 'DISABLED' && <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold"><XCircle size={12}/> Disabled</span>}
                        </td>
                        <td className="p-4">
                          {/* Mocking success rate visual for now, could be calculated in backend */}
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${wh.status === 'ACTIVE' ? 'bg-green-500 w-[98%]' : wh.status === 'FAILING' ? 'bg-amber-500 w-[40%]' : 'bg-red-500 w-[0%]'}`}></div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 text-xs">
                          {wh.lastTriggered ? formatDistanceToNow(new Date(wh.lastTriggered), { addSuffix: true }) : 'Never'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => toggleExpand(wh.id)} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="View Logs">
                              <Activity size={16} />
                            </button>
                            <button onClick={() => handleEdit(wh)} className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => { if(confirm('Delete this webhook?')) deleteMutation.mutate(wh.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === wh.id && (
                        <tr>
                          <td colSpan={6} className="p-0 border-b-2 border-brand-primary">
                            <WebhookDeliveryLog webhookId={wh.id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over */}
      {isSlideOverOpen && editingWebhook && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setIsSlideOverOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-md w-full flex">
            <div className="w-full h-full bg-white shadow-2xl flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-black text-xl text-slate-900">{editingWebhook.id ? 'Edit Webhook' : 'Add Webhook'}</h2>
                <button onClick={() => setIsSlideOverOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Endpoint URL</label>
                  <input 
                    type="url" 
                    value={editingWebhook.url} 
                    onChange={e => setEditingWebhook({...editingWebhook, url: e.target.value})}
                    placeholder="https://api.yoursystem.com/webhook"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Must be HTTPS in production.</p>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Secret Key</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editingWebhook.secret} 
                      onChange={e => setEditingWebhook({...editingWebhook, secret: e.target.value})}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-primary font-mono text-sm bg-slate-50"
                    />
                    <button 
                      onClick={() => setEditingWebhook({...editingWebhook, secret: generateSecret()})}
                      className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Used to generate HMAC-SHA256 signature.</p>
                </div>

                <div className="flex items-center justify-between py-4 border-y border-slate-100">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Status</div>
                    <div className="text-xs text-slate-500">Enable or disable this webhook</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={editingWebhook.isActive || false} 
                      onChange={(e) => setEditingWebhook({...editingWebhook, isActive: e.target.checked})} 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-3">Events to send</label>
                  
                  {['Orders', 'Payments', 'Customers', 'Loyalty', 'Staff', 'Menu', 'Inventory'].map(cat => (
                    <div key={cat} className="mb-4">
                      <h4 className="text-xs font-black uppercase text-slate-400 mb-2">{cat}</h4>
                      <div className="space-y-2 pl-2 border-l-2 border-slate-100">
                        {EVENTS.filter(e => e.category === cat).map(evt => (
                          <label key={evt.id} className="flex items-center gap-3 cursor-pointer group">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 text-brand-primary rounded border-slate-300 focus:ring-brand-primary"
                              checked={editingWebhook.events.includes(evt.id)}
                              onChange={(e) => {
                                const newEvents = e.target.checked 
                                  ? [...editingWebhook.events, evt.id]
                                  : editingWebhook.events.filter((id: string) => id !== evt.id);
                                setEditingWebhook({...editingWebhook, events: newEvents});
                              }}
                            />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900">{evt.label} <span className="text-xs text-slate-400 font-mono">({evt.id})</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsSlideOverOpen(false)} className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900">
                  Cancel
                </button>
                <button 
                  onClick={() => saveMutation.mutate(editingWebhook)}
                  disabled={saveMutation.isPending || !editingWebhook.url}
                  className="px-6 py-2 bg-orange-500 text-white rounded-xl font-bold shadow-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Webhook'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookDeliveryLog({ webhookId }: { webhookId: string }) {
  const queryClient = useQueryClient();
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhookId],
    queryFn: () => apiFetch<any[]>(`/api/webhooks/${webhookId}/deliveries`)
  });

  const testMutation = useMutation({
    mutationFn: () => apiFetch(`/api/webhooks/${webhookId}/test`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', webhookId] })
  });

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => apiFetch(`/api/webhooks/deliveries/${deliveryId}/retry`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', webhookId] })
  });

  if (isLoading) return <div className="bg-slate-50/80 p-6"><SkeletonList rows={4} /></div>;

  return (
    <div className="bg-slate-50/80 p-6 shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-900 flex items-center gap-2"><Activity size={16}/> Delivery History</h4>
        <button 
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
        >
          <Play size={12} className="text-brand-primary" /> 
          {testMutation.isPending ? 'Testing...' : 'Send Test Event'}
        </button>
      </div>

      {!deliveries || deliveries.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-xl border border-slate-200 border-dashed">
          No deliveries recorded yet. Send a test event to verify your endpoint.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">Triggered</th>
                <th className="p-3">Event</th>
                <th className="p-3">Status</th>
                <th className="p-3">Duration</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map((del) => (
                <tr key={del.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(del.triggeredAt), { addSuffix: true })}
                  </td>
                  <td className="p-3 font-mono text-slate-700 font-bold">{del.event}</td>
                  <td className="p-3">
                    {del.responseStatus && del.responseStatus >= 200 && del.responseStatus < 300 ? (
                      <span className="inline-flex items-center gap-1 text-green-600 font-bold"><CheckCircle2 size={12}/> {del.responseStatus}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold"><XCircle size={12}/> {del.responseStatus || 'FAIL'}</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 flex items-center gap-1">
                    <Clock size={12}/> {del.responseTime}ms
                  </td>
                  <td className="p-3 text-right">
                    <button 
                      onClick={() => retryMutation.mutate(del.id)}
                      disabled={retryMutation.isPending}
                      className="text-brand-primary font-bold hover:underline"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
