import React from "react";
import { Tablet, ShieldCheck, Zap, WifiOff, Layout, CreditCard, HelpCircle } from "lucide-react";
import Link from "next/link";
import { generateSEOMetadata, generateSoftwareApplicationSchema, generateFAQSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz POS — Tablet Point of Sale System for Restaurants in Pakistan",
  description:
    "Dineiz POS is a touch-optimized tablet POS system built for Pakistani restaurants. Order management, kitchen display, table map, and multiple payment methods. Free trial available.",
  path: "/product/pos",
});

const features = [
  {
    title: "Order Punching & Variations",
    desc: "Instant menu grid navigation with smart variation pickers for single/half/full portions and custom spice levels.",
    icon: Zap,
  },
  {
    title: "Interactive Table Map",
    desc: "Visual floor plan showing table occupancy, dining duration, split bills, and guest count at a glance.",
    icon: Layout,
  },
  {
    title: "Direct Kitchen Display (KDS)",
    desc: "Send KOT order slips digitally to kitchen prep screens instantly, eliminating paper order delays.",
    icon: Tablet,
  },
  {
    title: "Multi-Payment Collection",
    desc: "Accept cash and split payments in seconds.",
    icon: CreditCard,
  },
  {
    title: "100% Offline Mode",
    desc: "Keep punching orders during internet drops. All sales sync automatically when back online.",
    icon: WifiOff,
  },
  {
    title: "Shift Reconciliation & Security",
    desc: "Opening cash float, end-of-shift drawer reconciliation, Z-reports, and manager void PIN authorization.",
    icon: ShieldCheck,
  },
];

import { POS_FAQS } from "@/lib/faqs";

export const dynamic = 'force-static';

export default function POSPage() {
  const jsonLd = generateSoftwareApplicationSchema(
    "Dineiz POS",
    "Touch-optimized tablet point of sale system for Pakistani restaurants.",
    "2999"
  );
  const faqJsonLd = generateFAQSchema(POS_FAQS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">
            Tablet POS System
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            The tablet POS that keeps up with{" "}
            <span className="text-brand-500">your kitchen</span>
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto leading-relaxed">
            Built for speed, accuracy, and reliability during peak dining hours in Pakistani restaurants.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
            >
              Start 14-Day Free Trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white border border-gray-200 rounded-xl p-6 shadow-card"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-brand-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Hardware Specs */}
      <section className="bg-white py-16 lg:py-24 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">
            Supported Hardware & Printers
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                title: "Supported Tablets",
                items: ["Android Tablets (Android 8+)", "Apple iPad (iOS 14+)", "Windows Touch POS Machines"],
              },
              {
                title: "Thermal Printers",
                items: ["80mm & 58mm Thermal Printers", "LAN / Wi-Fi Network Printers", "Bluetooth Mobile Printers"],
              },
              {
                title: "Peripherals",
                items: ["USB Cash Drawers", "Barcode Scanners", "External Kitchen Display Monitors"],
              },
            ].map((col) => (
              <div key={col.title} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-500 mb-3">
                  {col.title}
                </div>
                <ul className="space-y-1.5">
                  {col.items.map((item) => (
                    <li key={item} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-brand-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POS Specific FAQ Section */}
      <section className="bg-gray-50 py-16 lg:py-24 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-semibold mb-3">
              <HelpCircle size={14} className="text-brand-500" />
              POS Questions Answered
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Frequently Asked Questions about Dineiz POS
            </h2>
          </div>

          <div className="space-y-4">
            {POS_FAQS.map((faq, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
