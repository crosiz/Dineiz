import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "POS for Food Carts & Small Shops in Pakistan — Dineiz",
  description: "Dineiz is the best POS and billing app for Pakistani food carts and small shops. Mobile-first, FBR-compliant, works offline, and free to start.",
  path: "/industries/dhaba",
  keywords: ["food cart billing software Pakistan", "small shop POS system", "street food billing app Pakistan"],
});

const benefits = [
  "Works on a Rs. 15,000 Android phone — no expensive hardware",
  "Offline mode for locations with unstable internet",
  "Accept JazzCash and EasyPaisa without a card machine",
  "FBR receipts via Bluetooth thermal printer",
  "Setup in 14 minutes — no IT team needed",
  "Roman Urdu WhatsApp ordering for regulars",
];

export default function DhabaPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Food Carts & Small Shops</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
              Billing made simple for <span className="text-brand-500">small restaurants</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Dineiz Go is the free mobile POS designed for the realities of running a food cart or small shop in Pakistan — no Wi-Fi required, no heavy hardware, no hassle.
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
                Start Free — No Credit Card
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
            <Link href="/industries/restaurant" className="text-brand-600 hover:underline">Full-Service Restaurant</Link>,{" "}
            <Link href="/industries/cafe" className="text-brand-600 hover:underline">Café & Bakery</Link>,{" "}
            <Link href="/industries/food-cart" className="text-brand-600 hover:underline">Food Cart</Link>
          </p>
        </div>
      </section>
    </>
  );
}
