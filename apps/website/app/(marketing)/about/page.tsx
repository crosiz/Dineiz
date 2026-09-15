import React from "react";
import Link from "next/link";
import { ShieldCheck, Heart, Sparkles, Building } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "About Dineiz — Built for Pakistan's Restaurants",
  description: "Learn about Dineiz, our mission to empower Pakistani restaurant owners with world-class SaaS tools, and our parent company Crosiz Technologies.",
  path: "/about",
});

const values = [
  { title: "Built for Pakistan", desc: "Designed specifically for local payment methods, tax rules, languages, and food workflows.", icon: ShieldCheck },
  { title: "Customer Obsessed", desc: "We answer customer calls 7 days a week because a restaurant never stops operating.", icon: Heart },
  { title: "Constantly Improving", desc: "We ship product updates every week based directly on real feedback from restaurant owners.", icon: Sparkles },
  { title: "Transparent & Honest", desc: "No hidden charges, no surprise fees, and simple affordable pricing for everyone.", icon: Building },
];

export const dynamic = 'force-static';

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">About</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
              Built for Pakistan&apos;s restaurant owners
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-6">
              Dineiz is a product by <strong className="text-gray-700">Crosiz Technologies</strong>, a Pakistani SaaS company on a mission to give every restaurant owner — from a small food cart to a premium dining chain — the same tools that global restaurant chains use.
            </p>
            <p className="text-base text-gray-500 leading-relaxed">
              We started Dineiz because we saw restaurant owners using paper receipts, WhatsApp voice notes, and Excel spreadsheets to run businesses doing millions of rupees a month. We knew there had to be a better way — one that was affordable, worked without reliable internet, supported local payments, and got GST right every time.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 border-b border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 tracking-tight">Our values</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="bg-white border border-gray-200 rounded-xl p-5 shadow-card">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-brand-500" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1.5">{v.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-50 border-t border-gray-100 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Ready to try Dineiz?</h3>
            <p className="text-sm text-gray-500 mt-1">14-day free trial. No credit card. Setup in 14 minutes.</p>
          </div>
          <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors whitespace-nowrap">
            Start Free Trial
          </Link>
        </div>
      </section>
    </>
  );
}

