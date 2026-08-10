import React from "react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({ title: "Refund Policy — Dineiz", description: "Read Dineiz's refund and cancellation policy.", path: "/refund-policy" });

export default function RefundPolicyPage() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-8 border-b border-gray-100">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Legal</span>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Refund Policy</h1>
          <p className="text-sm text-gray-400">Last updated: January 2025</p>
        </div>
        <div className="bg-brand-50 border border-brand-100 rounded-xl px-5 py-4 mb-8">
          <p className="text-sm text-brand-800 font-medium">
            We offer a 14-day free trial on all paid plans. You will not be charged until your trial ends.
          </p>
        </div>
        <div className="space-y-6">
          {[
            { title: "Monthly Subscriptions", body: "Monthly subscriptions may be cancelled at any time. Upon cancellation, your access continues until the end of the current billing period. We do not provide prorated refunds for partial months." },
            { title: "Annual Subscriptions", body: "Annual subscriptions may be cancelled within 30 days of the start date for a full refund minus a processing fee of Rs. 500. After 30 days, no refunds are issued for annual plans, though you may cancel to prevent renewal." },
            { title: "Technical Issues", body: "If you experience a service outage or technical issue attributable to Dineiz that prevents you from using the platform for more than 24 consecutive hours, we will credit your account with an equivalent number of days." },
            { title: "How to Request a Refund", body: "To request a refund, contact us at billing@dineiz.com or WhatsApp +92 300 1234567 with your account email and reason for the refund request. We process refund requests within 5–7 business days." },
          ].map((s) => (
            <div key={s.title}>
              <h2 className="text-base font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
