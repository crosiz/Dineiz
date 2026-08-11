import React from "react";
import Link from "next/link";
import { Smartphone, WifiOff, ReceiptText, Zap, Globe, CreditCard } from "lucide-react";
import { generateSEOMetadata, generateSoftwareApplicationSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz Go — Free Mobile POS App for Food Carts & Small Restaurants in Pakistan",
  description:
    "Dineiz Go is a free mobile POS app for small food businesses in Pakistan. Take orders, print receipts, and accept JazzCash/EasyPaisa — all on an Android phone.",
  path: "/product/go",
});

const features = [
  { icon: Smartphone, title: "Runs on Any Android Phone", desc: "No expensive hardware needed. Just install the app on your existing Android phone and start billing." },
  { icon: WifiOff, title: "Works Offline", desc: "Internet cuts out? No problem. Dineiz Go keeps taking orders and syncs when you're back online." },
  { icon: ReceiptText, title: "FBR Receipts on Mobile", desc: "Print FBR-valid receipts via Bluetooth thermal printer directly from your phone." },
  { icon: Zap, title: "Ultra-Fast Checkout", desc: "Counter and cart mode designed for speed — perfect for high-volume street food situations." },
  { icon: CreditCard, title: "JazzCash & EasyPaisa", desc: "Accept digital payments instantly without a card machine. Customers scan, you get paid." },
  { icon: Globe, title: "Multi-Language UI", desc: "Switch between English and Urdu interface — whichever your staff is comfortable with." },
];

export const dynamic = 'force-static';

export default function GoPage() {
  const jsonLd = generateSoftwareApplicationSchema("Dineiz Go", "Free mobile POS for food carts and small restaurants in Pakistan.", "0");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Mobile POS</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Free mobile POS for <span className="text-brand-500">food carts & small restaurants</span>
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">Runs on any Android phone. No hardware cost. Start billing in 14 minutes.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              Download Free
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

