import React from "react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({ title: "Terms of Service — Dineiz", description: "Read Dineiz Terms of Service.", path: "/terms-of-service" });

export const dynamic = 'force-static';

export default function TermsPage() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-8 border-b border-gray-100">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Legal</span>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: January 2025 · Governed by Pakistani law</p>
        </div>
        <div className="space-y-6">
          {[
            { title: "1. Acceptance of Terms", body: "By using Dineiz, you agree to these Terms of Service. If you do not agree, do not use our services. These terms apply to all users, including restaurant owners, managers, and staff." },
            { title: "2. Service Description", body: "Dineiz provides a cloud-based restaurant management platform including POS, billing, inventory, and analytics services. We reserve the right to modify or discontinue features with reasonable notice." },
            { title: "3. Account Responsibilities", body: "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account." },
            { title: "4. Payment Terms", body: "Subscriptions are billed monthly or annually in advance. Payments are processed in Pakistani Rupees (PKR). Failed payments may result in service suspension after a 7-day grace period." },
            { title: "5. Acceptable Use", body: "You agree not to use Dineiz for any illegal purpose, to input false transaction data, or to attempt to circumvent FBR compliance requirements. Violation may result in immediate account termination." },
            { title: "6. Limitation of Liability", body: "Dineiz shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the fees paid in the 12 months preceding the claim." },
            { title: "7. Governing Law", body: "These terms are governed by the laws of Pakistan. Any disputes shall be resolved in the courts of Lahore, Punjab, Pakistan." },
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

