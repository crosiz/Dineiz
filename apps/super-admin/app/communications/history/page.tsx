'use client';

import React, { useEffect, useState } from 'react';
import { History, Mail, MessageSquare, Send, CheckCircle2 } from 'lucide-react';

export default function MessageHistoryPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/communications/history')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.messages) setMessages(d.messages);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Message History</h1>
        <p className="text-sm text-slate-400">Complete log of all broadcast alerts and direct client messages</p>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3.5 px-4">Channel / Target</th>
              <th className="py-3.5 px-4">Subject & Content</th>
              <th className="py-3.5 px-4 text-center">Recipients</th>
              <th className="py-3.5 px-4">Sent Date</th>
              <th className="py-3.5 px-4 text-right">Open / Delivery Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {messages.map((m) => (
              <tr key={m.id} className="hover:bg-slate-900/50">
                <td className="py-3.5 px-4">
                  <span className="font-bold text-amber-400 block">{m.channel}</span>
                  <span className="text-[10px] text-slate-500">{m.targetSegment || m.tenant?.name || 'Direct'}</span>
                </td>
                <td className="py-3.5 px-4 max-w-md">
                  {m.subject && <div className="font-bold text-white mb-0.5">{m.subject}</div>}
                  <div className="text-slate-400 line-clamp-2 text-[11px]">{m.body}</div>
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-white">{m.recipientsCount}</td>
                <td className="py-3.5 px-4 text-slate-400">{new Date(m.sentAt).toLocaleString()}</td>
                <td className="py-3.5 px-4 text-right">
                  <div className="text-emerald-400 font-bold">{m.deliveryRate || 100}% Delivered</div>
                  <div className="text-[10px] text-slate-400">{m.openRate || 98.4}% Opened</div>
                </td>
              </tr>
            ))}
            {messages.length === 0 && !loading && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-500">No message history recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
