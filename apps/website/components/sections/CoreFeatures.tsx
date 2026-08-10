"use client";
import { Monitor, ChefHat, MessageCircle, TrendingUp } from "lucide-react";

const features = [
  {
    label: "Point of Sale",
    icon: Monitor,
    headline: "Billing in seconds.",
    desc: "A single screen for dine-in, takeaway, and delivery. Split bills, apply discounts, and generate FBR receipts with QR codes instantly. Works fully offline.",
  },
  {
    label: "Kitchen Display",
    icon: ChefHat,
    headline: "No more paper slips.",
    desc: "Orders appear on the kitchen screen the moment they are placed. Color-coded wait times keep your kitchen organized. One tap to mark complete.",
  },
  {
    label: "WhatsApp Ordering",
    icon: MessageCircle,
    headline: "Automated orders.",
    desc: "Customers message your WhatsApp. Dineiz reads the order, confirms it, and sends it directly to the kitchen. Zero staff intervention required.",
  },
  {
    label: "Analytics",
    icon: TrendingUp,
    headline: "Real-time numbers.",
    desc: "Open your phone to see today's revenue, top-selling items, and staff performance. Monitor all your branches from a single dashboard.",
  },
];

export function CoreFeatures() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        
        {/* Minimal header */}
        <div className="mb-20 max-w-2xl">
          <h2 
            className="font-bold text-[#1d1d1f] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Core features.
          </h2>
          <p className="text-[#6e6e73] text-lg">
            Everything you need to run your restaurant, without the clutter.
          </p>
        </div>

        {/* 2x2 Grid — clean, no borders, just typography and negative space */}
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-16">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.label}>
                <div className="w-10 h-10 mb-6 flex items-center justify-center rounded-lg bg-[#f5f5f7]">
                  <Icon size={18} className="text-[#1d1d1f]" />
                </div>
                <p className="text-[11px] font-bold text-[#FF6B35] uppercase tracking-widest mb-2">
                  {feat.label}
                </p>
                <h3 className="text-xl font-bold text-[#1d1d1f] mb-3 tracking-tight">
                  {feat.headline}
                </h3>
                <p className="text-[#6e6e73] text-[15px] leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
