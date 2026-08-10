'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Users,
  Mail,
  MessageSquare,
  Sparkles,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function SendAlertPage() {
  const [recipientSegment, setRecipientSegment] = useState('ALL');
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP' | 'BOTH'>('BOTH');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [scheduleOption, setScheduleOption] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledAt, setScheduledAt] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [sending, setSending] = useState(false);

  // Live preview interpolation with sample data
  const sampleData = {
    restaurant_name: 'Spice Bazaar',
    owner_name: 'Tariq Khan',
    plan_name: 'Pro Plan',
    renewal_date: '2026-08-15',
  };

  const interpolatedPreview = messageBody
    .replace(/\{\{restaurant_name\}\}/g, sampleData.restaurant_name)
    .replace(/\{\{owner_name\}\}/g, sampleData.owner_name)
    .replace(/\{\{plan_name\}\}/g, sampleData.plan_name)
    .replace(/\{\{renewal_date\}\}/g, sampleData.renewal_date);

  const insertMergeTag = (tag: string) => {
    setMessageBody((prev) => prev + ` {{${tag}}}`);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientSegment,
          selectedPlans,
          channel,
          subject,
          messageBody,
          scheduledAt: scheduleOption === 'SCHEDULED' ? scheduledAt : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send broadcast');
      } else {
        setShowConfirmModal(false);
        alert(`Broadcast successfully sent to ${data.recipientsCount} clients!`);
        setMessageBody('');
        setSubject('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Send Platform Broadcast Alert</h1>
        <p className="text-sm text-slate-400">Broadcast updates, maintenance alerts, or promotional announcements</p>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        {/* Recipient Segment */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">Recipient Segment</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'ALL', label: 'All Clients' },
              { key: 'PRO_ONLY', label: 'Pro Plan Only' },
              { key: 'STARTER_ONLY', label: 'Starter Plan Only' },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setRecipientSegment(s.key)}
                className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                  recipientSegment === s.key
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Communication Channel */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">Channel</label>
          <div className="flex gap-3">
            {[
              { key: 'EMAIL', label: 'Email Only' },
              { key: 'WHATSAPP', label: 'WhatsApp Only' },
              { key: 'BOTH', label: 'Both Email & WhatsApp' },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setChannel(c.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  channel === c.key
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject (if Email) */}
        {(channel === 'EMAIL' || channel === 'BOTH') && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Subject</label>
            <input
              type="text"
              placeholder="e.g. Important Feature Update for {{restaurant_name}}"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>
        )}

        {/* Message Body & Merge Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300">Message Body</label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 mr-1">Insert Merge Tags:</span>
              {['restaurant_name', 'owner_name', 'plan_name', 'renewal_date'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertMergeTag(tag)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 border border-slate-700"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex border-b border-slate-800 mb-3 gap-2">
            <button
              onClick={() => setPreviewTab('EDIT')}
              className={`px-3 py-1.5 text-xs font-bold border-b-2 ${
                previewTab === 'EDIT' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
              }`}
            >
              Compose Editor
            </button>
            <button
              onClick={() => setPreviewTab('PREVIEW')}
              className={`px-3 py-1.5 text-xs font-bold border-b-2 flex items-center gap-1 ${
                previewTab === 'PREVIEW' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Sample Preview</span>
            </button>
          </div>

          {previewTab === 'EDIT' ? (
            <textarea
              rows={8}
              placeholder="Write announcement body here. Use {{restaurant_name}} or {{owner_name}} to personalize..."
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
            />
          ) : (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 min-h-[160px] whitespace-pre-wrap">
              {interpolatedPreview || <span className="text-slate-500">Preview will appear here when message body is typed.</span>}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-4 border-t border-slate-800 pt-4">
          <label className="text-xs font-semibold text-slate-300">Schedule:</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="radio"
                checked={scheduleOption === 'NOW'}
                onChange={() => setScheduleOption('NOW')}
              />
              <span>Send Immediately</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="radio"
                checked={scheduleOption === 'SCHEDULED'}
                onChange={() => setScheduleOption('SCHEDULED')}
              />
              <span>Schedule Later</span>
            </label>
          </div>

          {scheduleOption === 'SCHEDULED' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          )}
        </div>

        {/* Confirm Action Button */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg"
          >
            <Send className="w-4 h-4" />
            <span>Review & Send Alert</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Broadcast Launch</h3>
            </div>
            <p className="text-xs text-slate-300">
              You are about to send a broadcast alert to <strong className="text-white">{recipientSegment}</strong> via <strong className="text-amber-400">{channel}</strong>.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400">
              Subject: {subject || 'Announcement'}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-5 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl"
              >
                {sending ? 'Sending...' : 'Confirm & Launch Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
