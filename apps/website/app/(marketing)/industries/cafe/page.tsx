import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Café & Bakery POS Pakistan — Dineiz",
  description: "Dineiz is the ideal POS for cafés and bakeries in Pakistan. Manage counter orders, loyalty, WhatsApp pre-orders, and FBR receipts with ease.",
  path: "/industries/cafe",
});

const benefits = [
  "Counter-mode POS for fast service",
  "Item variations: size, milk type, sugar level",
  "WhatsApp pre-orders with payment link",
  "Daily sales and waste tracking",
  "FBR receipts for every transaction",
  "Loyalty punch card tracking",
  "Inventory for ingredients (flour, milk, sugar)",
  "Barista-friendly touchscreen interface",
];

export default function CafePage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Café & Bakery</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
              Smart POS for <span className="text-brand-500">cafés & bakeries</span> in Pakistan
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Dineiz is built for the fast pace of café service — from quick counter orders to WhatsApp pre-orders and ingredient tracking.
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
                Start Free Trial
              </Link>
              <Link href="/product/pos" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
                Explore Features
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-500">Also available for: {" "}
            <Link href="/industries/restaurant" className="text-brand-600 hover:underline">Full-Service Restaurant</Link>,{" "}
            <Link href="/industries/dhaba" className="text-brand-600 hover:underline">Small Restaurants</Link>,{" "}
            <Link href="/industries/food-cart" className="text-brand-600 hover:underline">Food Carts</Link>
          </p>
        </div>
      </section>
    </>
  );
}
