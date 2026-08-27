import React from "react";
import Link from "next/link";
import { MessageCircle, Clock, CreditCard, Languages, Zap, TrendingUp } from "lucide-react";
import { generateSEOMetadata, generateSoftwareApplicationSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "WhatsApp Ordering — AI-Assisted Restaurant Orders via WhatsApp in Pakistan",
  description:
    "Dineiz WhatsApp ordering lets customers order via WhatsApp in Urdu and English. AI reads and drafts the order; your staff confirms it before it goes to the kitchen.",
  path: "/product/whatsapp",
});

const features = [
  { icon: Clock, title: "Orders Anytime", desc: "Customers can message in an order whenever they like — it's waiting for staff to confirm the moment someone's free." },
  { icon: Languages, title: "Roman Urdu & English", desc: "Customers can message in Roman Urdu, English, or a mix. The AI reads the message and drafts the order for your staff." },
  { icon: CreditCard, title: "Cash on Delivery Confirmation", desc: "Staff confirms the payment method with the customer before the order is sent to the kitchen." },
  { icon: Zap, title: "Kitchen Routing", desc: "Once staff confirm an order, it goes straight to the kitchen display — no re-typing it into the POS." },
  { icon: MessageCircle, title: "Order Status Updates", desc: "Customers get WhatsApp updates when their order is confirmed, in preparation, and ready." },
  { icon: TrendingUp, title: "WhatsApp Order Analytics", desc: "See how many orders come from WhatsApp, average value, peak times, and most popular items." },
];

export const dynamic = 'force-static';

export default function WhatsAppPage() {
  const jsonLd = generateSoftwareApplicationSchema("Dineiz WhatsApp Ordering", "AI-assisted WhatsApp ordering for Pakistani restaurants.", "999");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-600 mb-4">WhatsApp Ordering</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight max-w-3xl mx-auto">
            Orders straight from <span className="text-green-600">WhatsApp</span>
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">Customers order in Urdu or English. The AI reads the message and drafts it — your staff confirms and sends it to the kitchen.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Enable WhatsApp Ordering
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

