'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="bg-brand-50 rounded-2xl p-8 border border-brand-100 text-center">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-brand-500">
        <Mail size={24} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Get POS tips in your inbox</h3>
      <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
        Weekly insights on restaurant growth and GST compliance for Pakistani restaurant owners.
      </p>

      {status === 'error' && (
        <p className="text-red-600 text-sm mb-4">Something went wrong — please try again.</p>
      )}

      {status === 'success' ? (
        <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 py-3 rounded-xl font-medium">
          <CheckCircle2 size={20} />
          You're subscribed!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-grow px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            required
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-3 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}
    </div>
  );
}
