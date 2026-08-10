import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Food Cart & Stall POS Pakistan — Dineiz Go Free",
  description: "Free POS app for food carts and stalls in Pakistan. Run on a cheap Android phone, accept JazzCash, generate FBR receipts, and track your daily sales.",
  path: "/industries/food-cart",
});

const benefits = [
  "Free forever — no monthly fee for basic use",
  "Runs on the cheapest Android phones",
  "No Wi-Fi required — full offline mode",
  "Accept JazzCash / EasyPaisa via QR",
  "Print FBR receipt on a tiny Bluetooth printer",
  "Daily cash summary at end of shift",
  "Simple product list — no complex menu needed",
];

export default function FoodCartPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Food Cart & Stall</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
              Free POS for <span className="text-brand-500">food carts</span> in Pakistan
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Dineiz Go is completely free for food cart and stall operators. No monthly fee, no hardware cost — just download and start billing.
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
                Download Free Now
              </Link>
              <Link href="/product/go" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
                Learn About Dineiz Go
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">Also available for: {" "}
            <Link href="/industries/restaurant" className="text-brand-600 hover:underline">Restaurants</Link>,{" "}
            <Link href="/industries/dhaba" className="text-brand-600 hover:underline">Small Restaurants</Link>,{" "}
            <Link href="/industries/cafe" className="text-brand-600 hover:underline">Cafés</Link>
          </p>
        </div>
      </section>
    </>
  );
}
