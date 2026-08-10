import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Restaurant POS System Pakistan — Dineiz Full-Service Restaurant",
  description: "Dineiz POS is built for full-service restaurants in Pakistan. Table management, KDS, FBR compliance, multi-payment, and real-time analytics for dine-in restaurants.",
  path: "/industries/restaurant",
  keywords: ["restaurant POS Pakistan", "restaurant billing software Pakistan", "restaurant management system Pakistan"],
});

const benefits = [
  "Visual table map with real-time occupancy and timer",
  "Kitchen Display System (KDS) — no paper slips",
  "Split bills, multi-payment per table",
  "FBR-compliant digital receipts with QR",
  "Multi-branch analytics from a single dashboard",
  "Staff roles: manager, cashier, waiter — separate access",
  "WhatsApp AI for takeaway and delivery orders",
  "Inventory management with low-stock alerts",
];

export default function RestaurantPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Full-Service Restaurant</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
              POS built for <span className="text-brand-500">full-service restaurants</span> in Pakistan
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              From single-location restaurants to growing chains — Dineiz POS handles table management, kitchen workflow, and FBR compliance all in one system.
            </p>
            <ul className="space-y-3 mb-8">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <Check size={16} className="text-brand-500 mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                Start 14-Day Free Trial
              </Link>
              <Link href="/product/pos" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
                Explore Dineiz POS
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">Also available for: {" "}
            <Link href="/industries/dhaba" className="text-brand-600 hover:underline">Small Restaurants</Link>,{" "}
            <Link href="/industries/cafe" className="text-brand-600 hover:underline">Cafés</Link>,{" "}
            <Link href="/industries/food-cart" className="text-brand-600 hover:underline">Food Carts</Link>
          </p>
        </div>
      </section>
    </>
  );
}
