import React from "react";
import Link from "next/link";
import { MessageCircle, Clock, CreditCard, Languages, Zap, TrendingUp } from "lucide-react";
import { generateSEOMetadata, generateSoftwareApplicationSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "WhatsApp AI Ordering — Automated Restaurant Orders via WhatsApp in Pakistan",
  description:
    "Dineiz WhatsApp AI takes restaurant orders automatically via WhatsApp — in Urdu and English. 24/7 ordering without any staff. JazzCash and EasyPaisa payment links included.",
  path: "/product/whatsapp",
});

const features = [
  { icon: Clock, title: "24/7 Ordering — No Staff", desc: "The AI never sleeps. Take orders at midnight, on weekends, and during rush hour — simultaneously." },
  { icon: Languages, title: "Roman Urdu & English", desc: "Customers can message in Roman Urdu, English, or a mix. The AI understands and responds naturally." },
  { icon: CreditCard, title: "Built-in Payment Links", desc: "Sends a JazzCash or EasyPaisa payment link with every order. Customer pays, kitchen gets the order." },
  { icon: Zap, title: "Instant Kitchen Routing", desc: "Confirmed orders go straight to the kitchen display. No staff needed in the loop." },
  { icon: MessageCircle, title: "Order Status Updates", desc: "Customers get WhatsApp updates when their order is confirmed, in preparation, and ready." },
  { icon: TrendingUp, title: "WhatsApp Order Analytics", desc: "See how many orders come from WhatsApp, average value, peak times, and most popular items." },
];

export const dynamic = 'force-static';

export default function WhatsAppPage() {
  const jsonLd = generateSoftwareApplicationSchema("Dineiz WhatsApp AI", "Automated WhatsApp ordering for Pakistani restaurants.", "999");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-600 mb-4">WhatsApp AI Ordering</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Your AI waiter on <span className="text-green-600">WhatsApp</span> — 24/7
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">Takes orders in Urdu or English, sends payment links, and routes to kitchen — automatically.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Enable WhatsApp AI
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-green-500 hover:text-green-700 transition-colors">
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
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-green-600" />
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

