import React from "react";
import { Tablet, ChefHat, TrendingUp, MessageSquare, Boxes, Building2, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz Features — Complete Restaurant Software Platform",
  description: "Explore all features of Dineiz: Tablet POS, KDS, inventory, WhatsApp AI ordering, FBR tax sync, and multi-branch analytics.",
  path: "/features",
});

const featureList = [
  { title: "Tablet POS Order Punching", icon: Tablet, desc: "Lightning fast checkout with dish variation pickers & offline sync." },
  { title: "Kitchen Display System (KDS)", icon: ChefHat, desc: "Digital station routing & preparation timer alerts for kitchen staff." },
  { title: "Real-time Sales Analytics", icon: TrendingUp, desc: "Hourly revenue breakdown, dish popularity metrics, and cash flow." },
  { title: "WhatsApp AI Ordering Bot", icon: MessageSquare, desc: "24/7 automated order taking with JazzCash & EasyPaisa QR payment." },
  { title: "Recipe Raw Inventory", icon: Boxes, desc: "Automatic ingredient deduction per dish sold & low stock alerts." },
  { title: "Multi-branch Command", icon: Building2, desc: "Central web admin to compare revenue across all restaurant locations." },
  { title: "FBR GST Compliance", icon: ShieldCheck, desc: "Automatic FBR QR code invoice printing & STRN tax reports." },
  { title: "Staff Shift Reconciliation", icon: Zap, desc: "Opening float, cashier drawer reconciliation, and manager PIN overrides." },
];

export const dynamic = 'force-static';

export default function FeaturesPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Features</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Everything your restaurant needs
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
            One platform to run billing, kitchen, analytics, and ordering — built for Pakistan.
          </p>
        </div>
      </section>
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {featureList.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-5 shadow-card">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-brand-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              Start Free Trial — 14 Days
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

