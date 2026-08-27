import React from "react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Privacy Policy — Dineiz",
  description: "Read Dineiz's privacy policy to understand how we collect, use, and protect your data.",
  path: "/privacy-policy",
});

export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-8 border-b border-gray-100">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Legal</span>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: January 2025</p>
        </div>
        <div className="prose prose-sm prose-gray max-w-none space-y-6">
          {[
            { title: "1. Information We Collect", body: "We collect information you provide directly to us when you create an account, use our services, or contact us. This includes restaurant name, contact details, billing information, and transaction data processed through Dineiz." },
            { title: "2. How We Use Your Information", body: "We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and respond to your comments and questions." },
            { title: "3. Information Sharing", body: "We do not sell, trade, or rent your personal information to third parties. We may share information with service providers who assist us in operating our platform, including cloud hosting providers and payment processors." },
            { title: "4. Data Security", body: "We implement industry-standard security measures to protect your data. All data is encrypted in transit using TLS and at rest using AES-256. We conduct regular security audits and maintain backups." },
            { title: "5. Data Retention", body: "We retain your data for as long as your account is active or as needed to provide services. Transaction records are retained for 7 years as required by Pakistani tax law (FBR regulations)." },
            { title: "6. Your Rights", body: "You have the right to access, correct, or delete your personal data. You may also request a copy of your data in a portable format. To exercise these rights, contact us at privacy@dineiz.com." },
            { title: "7. Contact Us", body: "If you have any questions about this Privacy Policy, please contact us at privacy@dineiz.com or via WhatsApp at +92 314 1986044." },
          ].map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-gray-900 mb-2">{section.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

