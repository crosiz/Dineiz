'use client';

import React from 'react';

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Email & WhatsApp Templates</h1>
        <p className="text-sm text-slate-400">Pre-configured message templates for client communication</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: 'Payment Reminder', body: 'Salam {{owner_name}}! Aapki Dineiz {{plan_name}} subscription {{renewal_date}} ko renew hogi...' },
          { title: 'Trial Ending Notice', body: 'Hi {{owner_name}}, Your 14-day free trial on Dineiz for {{restaurant_name}} is ending soon...' },
          { title: 'Welcome Onboarding', body: 'Welcome to Dineiz Platform {{owner_name}}! Your console URL is console.dineiz.com...' },
          { title: 'Support Response', body: 'Hi {{owner_name}}, Our support engineering team has resolved your ticket for {{restaurant_name}}...' },
        ].map((t) => (
          <div key={t.title} className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-2">
            <h3 className="text-xs font-bold text-amber-400">{t.title}</h3>
            <p className="text-xs text-slate-300 font-mono bg-slate-900 p-3 rounded-xl border border-slate-800">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
