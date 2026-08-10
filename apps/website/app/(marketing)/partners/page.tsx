import React from "react";
import Link from "next/link";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({ title: "Partners — Dineiz Partner Program", description: "Become a Dineiz partner and earn commissions referring restaurants.", path: "/partners" });

const tiers = [
  { name: "Referral Partner", desc: "Refer restaurants to Dineiz and earn 20% recurring commission for 12 months.", badge: "bg-gray-100 text-gray-700" },
  { name: "Reseller Partner", desc: "Sell and onboard Dineiz to restaurants in your region. Up to 35% commission + support resources.", badge: "bg-brand-100 text-brand-700" },
  { name: "Integration Partner", desc: "Integrate your hardware or software with Dineiz. Joint marketing and co-sell opportunities.", badge: "bg-blue-100 text-blue-700" },
];

export default function PartnersPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Partners</span>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">Grow with Dineiz</h1>
          <p className="text-base text-gray-500 max-w-xl mx-auto">
            Join our partner ecosystem — whether you are a freelancer, an IT reseller, or a hardware company, there is a program for you.
          </p>
        </div>
      </section>
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {tiers.map((tier) => (
              <div key={tier.name} className="bg-white border border-gray-200 rounded-xl p-6 shadow-card">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-4 ${tier.badge}`}>
                  {tier.name}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{tier.desc}</p>
              </div>
            ))}
          </div>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Interested in partnering?</h2>
            <p className="text-sm text-gray-500 mb-6">Fill in the contact form and select &ldquo;Partnership Inquiry&rdquo; — our team will reach out within 24 hours.</p>
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              Apply to Become a Partner
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
