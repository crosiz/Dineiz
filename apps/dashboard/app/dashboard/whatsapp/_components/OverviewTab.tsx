'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PageLoader } from '@/components/ui/Spinner';

const STAGE_LABELS: Record<string, string> = {
  GREETING: 'Just started',
  BROWSING_MENU: 'Browsing menu',
  BUILDING_ORDER: 'Building order',
  COLLECTING_ORDER_TYPE: 'Choosing order type',
  COLLECTING_ADDRESS: 'Entering address',
  SELECTING_PAYMENT: 'Confirming order',
  CONFIRMED: 'Order confirmed',
};

function formatTimeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function OverviewTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [ordersRes, convRes] = await Promise.all([
        apiFetch<{ orders: any[] }>('/api/orders/history?source=WHATSAPP&limit=10'),
        apiFetch<{ conversations: any[] }>('/api/whatsapp/conversations?status=active'),
      ]);
      setOrders(ordersRes.orders || []);
      setConversations(convRes.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <PageLoader label="Loading conversations..." className="min-h-[160px]" />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Recent WhatsApp Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</p>
        </div>
        <div className="border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-bold uppercase text-gray-400 tracking-wider">Active Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{conversations.length}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Active Conversations</h3>
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-400">No active conversations right now.</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.customer?.name || c.phoneNumber}</p>
                  <p className="text-xs text-gray-400">{c.phoneNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold bg-[#25D366]/10 text-[#128C7E] px-2 py-1 rounded-full">
                    {STAGE_LABELS[c.stage] || c.stage}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(c.lastMessageAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Orders</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400">No WhatsApp orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">#{o.orderNumber}</p>
                  <p className="text-xs text-gray-400">{o.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">PKR {Math.round(o.total)}</p>
                  <p className="text-xs text-gray-400">{o.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
