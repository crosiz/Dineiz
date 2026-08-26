import React from "react";
import Link from "next/link";
import { PieChart, Globe, Users, TrendingUp, Download, Bell } from "lucide-react";
import { generateSEOMetadata, generateSoftwareApplicationSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz Console — Restaurant Analytics & Multi-Branch Dashboard Pakistan",
  description:
    "Dineiz Console is a web-based analytics dashboard for restaurant owners in Pakistan. Monitor sales, staff performance, and inventory across all your branches in real time.",
  path: "/product/console",
});

const features = [
  { icon: PieChart, title: "Real-Time Sales Dashboard", desc: "Hourly, daily, weekly, and monthly sales — see exactly what's happening in your restaurant right now." },
  { icon: Globe, title: "Multi-Branch View", desc: "Manage up to 10 branches from a single login. Compare performance, spot outliers, act fast." },
  { icon: Users, title: "Staff Performance Reports", desc: "See which staff members are fastest, most accurate, and highest-selling — with full shift history." },
  { icon: TrendingUp, title: "Menu Analytics", desc: "Know your bestsellers, slow movers, and profit drivers. Make menu decisions with actual data." },
  { icon: Download, title: "Export to Excel & PDF", desc: "Download any report as Excel or PDF for accountants, investors, or your own tax records." },
  { icon: Bell, title: "Smart Alerts", desc: "Get SMS or WhatsApp alerts when sales drop, stock runs low, or a cashier voids too many orders." },
];

export const dynamic = 'force-static';

export default function ConsolePage() {
  const jsonLd = generateSoftwareApplicationSchema("Dineiz Console", "Web-based analytics dashboard for restaurant owners in Pakistan.", "2999");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Owner Dashboard</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            See everything in your restaurant — <span className="text-brand-500">in real time</span>
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">Web-based analytics dashboard designed for restaurant owners across Pakistan.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              Start Free Trial
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-card">
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
    </>
  );
}

