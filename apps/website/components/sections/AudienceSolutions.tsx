import React from "react";
import Link from "next/link";
import { Utensils, Coffee, Flame, Truck, Store, Building2, ArrowRight } from "lucide-react";

const audiences = [
  {
    title: "Dine-In Restaurants",
    desc: "Interactive visual table floor plans, split checks, order course timing, and synchronized KDS.",
    icon: Utensils,
    href: "/industries/restaurant",
    tag: "Full-Service",
  },
  {
    title: "Cafes & Bakeries",
    desc: "Lightning fast counter checkout, syrup & milk modifier options, and barista station displays.",
    icon: Coffee,
    href: "/industries/cafe",
    tag: "Fast Counter",
  },
  {
    title: "Dhabas & Chai Stalls",
    desc: "High-volume cash billing, 100% offline resilience during load shedding, and Roman Urdu support.",
    icon: Flame,
    href: "/industries/dhaba",
    tag: "Zero Internet Drop",
  },
  {
    title: "Food Carts & Kiosks",
    desc: "Pocket Android mobile billing with portable Bluetooth battery printers. Zero upfront hardware cost.",
    icon: Truck,
    href: "/industries/food-cart",
    tag: "Mobile POS",
  },
  {
    title: "Cloud Kitchens & Delivery",
    desc: "Automated WhatsApp AI ordering, direct customer orders with zero commissions, and kitchen routing.",
    icon: Store,
    href: "/product/whatsapp",
    tag: "WhatsApp AI",
  },
  {
    title: "Multi-Branch Chains",
    desc: "Centralized menu catalog, multi-outlet live telemetry, consolidated inventory, and role permissions.",
    icon: Building2,
    href: "/product/console",
    tag: "Franchise Hub",
  },
];

export function AudienceSolutions() {
  return (
    <section className="bg-white py-20 lg:py-28 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">
            Tailored For Every Hospitality Business
          </p>
          <h2
            className="font-bold text-[#1d1d1f] tracking-tight mb-4"
            style={{ fontSize: "clamp(1.9rem, 3.8vw, 2.7rem)", lineHeight: 1.15 }}
          >
            Built for whatever you serve, wherever you operate.
          </h2>
          <p className="text-base text-[#6e6e73] leading-relaxed">
            From single food carts to multi-branch restaurant groups, Dineiz adapts to your exact operational workflow without requiring expensive custom setups.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {audiences.map((aud) => {
            const Icon = aud.icon;
            return (
              <Link
                key={aud.title}
                href={aud.href}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-gray-200 bg-white hover:border-brand-300 hover:shadow-card-lg transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      <Icon size={20} />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      {aud.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-brand-500 transition-colors">
                    {aud.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                    {aud.desc}
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-semibold text-brand-500 group-hover:gap-1.5 transition-all">
                  Explore solution
                  <ArrowRight size={13} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
