"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Check, Minus, MessageSquare, ArrowRight } from "lucide-react";
import { generateProductPricingSchema } from "@/lib/seo";
import { Accordion } from "@/components/ui/Accordion";
import { motion, AnimatePresence } from "framer-motion";

const allFeatures = [
  "Cloud-based point of sale",
  "Order management",
  "Menu management",
  "Inventory management",
  "Revenue reconciliation",
  "Analytics & reports",
  "Shift schedule",
  "Offline mode",
  "24/7 support",
  "Tax integrations (FBR/GST)",
  "FoodPanda integration",
  "JazzCash & EasyPaisa",
  "WhatsApp AI ordering",
  "Kitchen Display (KDS)",
  "Multi-branch management",
];

const plans = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Free forever",
    desc: "For small restaurants just getting started.",
    price: { monthly: 0, annual: 0 },
    cta: "Start Free",
    href: "/contact",
    highlight: false,
    features: [
      true,   // Cloud POS
      true,   // Order mgmt
      true,   // Menu mgmt
      false,  // Inventory
      false,  // Revenue recon
      false,  // Analytics
      false,  // Shift
      true,   // Offline
      "email", // Support
      false,  // Tax
      false,  // FoodPanda
      false,  // JazzCash
      false,  // WhatsApp
      false,  // KDS
      false,  // Multi-branch
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Most popular",
    desc: "For single-location restaurants ready to scale.",
    price: { monthly: 4999, annual: 3749 },
    cta: "Start Free Trial",
    href: "/contact",
    highlight: true,
    features: [
      true,   // Cloud POS
      true,   // Order mgmt
      true,   // Menu mgmt
      true,   // Inventory
      true,   // Revenue recon
      true,   // Analytics
      true,   // Shift
      true,   // Offline
      true,   // Support 24/7
      true,   // Tax
      false,  // FoodPanda
      true,   // JazzCash
      true,   // WhatsApp
      false,  // KDS
      false,  // Multi-branch
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Full power",
    desc: "For multi-branch restaurants demanding advanced features.",
    price: { monthly: 9999, annual: 7499 },
    cta: "Start Free Trial",
    href: "/contact",
    highlight: false,
    features: [
      true,  // Cloud POS
      true,  // Order mgmt
      true,  // Menu mgmt
      true,  // Inventory
      true,  // Revenue recon
      true,  // Analytics
      true,  // Shift
      true,  // Offline
      true,  // Support 24/7
      true,  // Tax
      true,  // FoodPanda
      true,  // JazzCash
      true,  // WhatsApp
      true,  // KDS
      true,  // Multi-branch
    ],
  },
];

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={15} strokeWidth={2.5} className="mx-auto text-[#1d1d1f]" />;
  if (value === "email") return <span className="text-xs text-[#6e6e73] font-medium">Email</span>;
  return <Minus size={14} className="mx-auto text-[#d2d2d7]" strokeWidth={2} />;
}

const faqs = [
  { q: "Is there a setup fee?", a: "No. Dineiz has zero setup fees, zero installation charges, and zero hidden costs. You pay only the monthly or annual subscription." },
  { q: "Can I try before I pay?", a: "Yes. All paid plans come with a 14-day free trial — no credit card required. Start today and see if Dineiz is right for your restaurant." },
  { q: "Does the free plan expire?", a: "No. The Starter plan is free forever for a single location. It never expires, and we will never charge you for it." },
  { q: "What payment methods do you accept?", a: "We accept JazzCash, EasyPaisa, bank transfer (HBL, MCB, UBL), and credit card (Visa/Mastercard) for subscription payments." },
  { q: "What happens after my trial ends?", a: "You will be notified 3 days before your trial ends. You can upgrade to a paid plan or your account switches to the free Starter plan automatically." },
  { q: "Can I switch plans?", a: "Yes, you can upgrade or downgrade at any time. If you upgrade mid-cycle, we prorate the difference. If you downgrade, the change takes effect on your next billing date." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const jsonLd = generateProductPricingSchema();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="bg-white py-16 lg:py-24 border-b border-[#f5f5f7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-4">Pricing</p>
          <h1
            className="font-bold text-[#1d1d1f] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Simple, transparent pricing.
          </h1>
          <p className="text-[#6e6e73] text-lg max-w-lg mx-auto mb-8">
            No setup fees. No hidden charges. Cancel anytime.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 p-1 bg-[#f5f5f7] rounded-full">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!annual ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73]"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${annual ? "bg-white shadow-sm text-[#1d1d1f]" : "text-[#6e6e73]"}`}
            >
              Annual <span className="text-[11px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">−25%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Cards Section */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const price = annual ? plan.price.annual : plan.price.monthly;
              const savings = (plan.price.monthly - plan.price.annual) * 12;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border ${
                    plan.highlight
                      ? "border-[#FF6B35] shadow-[0_0_0_1px_rgba(255,107,53,0.15),0_8px_32px_rgba(255,107,53,0.08)]"
                      : "border-[#d2d2d7]"
                  } bg-white overflow-hidden`}
                >
                  {plan.highlight && (
                    <div className="bg-[#FF6B35] text-white text-[11px] font-bold tracking-widest uppercase text-center py-1.5 px-4">
                      Most Popular
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* Plan header */}
                    <div className="mb-6">
                      <p className="text-[11px] font-bold text-[#6e6e73] uppercase tracking-widest mb-1">
                        {plan.tagline}
                      </p>
                      <h3 className="text-xl font-bold text-[#1d1d1f] mb-1">{plan.name}</h3>
                      <p className="text-sm text-[#6e6e73]">{plan.desc}</p>
                    </div>

                    {/* Price */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={annual ? "a" : "m"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="mb-7 pb-7 border-b border-[#f5f5f7]"
                      >
                        {price === 0 ? (
                          <div
                            className="text-4xl font-extrabold text-[#1d1d1f]"
                            style={{ letterSpacing: "-0.04em" }}
                          >
                            Free
                          </div>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm text-[#6e6e73]">Rs.</span>
                              <span
                                className="text-4xl font-extrabold text-[#1d1d1f]"
                                style={{ letterSpacing: "-0.04em", lineHeight: 1 }}
                              >
                                {price.toLocaleString()}
                              </span>
                              <span className="text-sm text-[#6e6e73]">/mo</span>
                            </div>
                            {annual && savings > 0 && (
                              <p className="text-xs font-medium text-green-700 mt-1.5">
                                Save Rs.&nbsp;{savings.toLocaleString()} per year
                              </p>
                            )}
                          </>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Feature list — show only included ones */}
                    <ul className="space-y-2.5 flex-1 mb-8">
                      {allFeatures.map((feat, i) => {
                        const val = plan.features[i];
                        if (!val) return null;
                        return (
                          <li key={feat} className="flex items-center gap-2.5 text-sm text-[#1d1d1f]">
                            <Check
                              size={14}
                              strokeWidth={2.5}
                              className={plan.highlight ? "text-[#FF6B35] shrink-0" : "shrink-0"}
                            />
                            {feat}
                            {val === "email" && <span className="text-[#6e6e73] text-xs">(email only)</span>}
                          </li>
                        );
                      })}
                    </ul>

                    <Link
                      href={plan.href}
                      className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                        plan.highlight
                          ? "bg-[#FF6B35] text-white hover:bg-[#e65a25]"
                          : "border border-[#d2d2d7] text-[#1d1d1f] hover:border-[#1d1d1f]"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full Comparison Table Section */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          
          <div className="bg-white border border-[#d2d2d7] rounded-2xl overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5ea]">
                    <th className="text-left px-6 py-6 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider w-52">
                      Feature Comparison
                    </th>
                    {plans.map((p) => {
                      const price = annual ? p.price.annual : p.price.monthly;
                      return (
                        <th
                          key={p.id}
                          className={`px-5 py-6 text-center ${p.highlight ? "bg-[#fff8f5]" : ""}`}
                        >
                          <div className={`text-sm font-bold ${p.highlight ? "text-[#FF6B35]" : "text-[#1d1d1f]"}`}>
                            {p.name}
                          </div>
                          <div className="text-[14px] font-semibold text-[#1d1d1f] mt-1.5">
                            {price === 0 ? "Free" : `Rs. ${price.toLocaleString()}/mo`}
                          </div>
                          <Link
                            href={p.href}
                            className={`inline-block mt-3 px-5 py-2 rounded-full text-[12px] font-semibold transition-colors ${
                              p.highlight
                                ? "bg-[#FF6B35] text-white hover:bg-[#e65a25]"
                                : "border border-[#d2d2d7] text-[#1d1d1f] hover:border-[#1d1d1f]"
                            }`}
                          >
                            {p.cta}
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allFeatures.map((feat, i) => (
                    <tr
                      key={feat}
                      className={`border-b border-[#f5f5f7] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}
                    >
                      <td className="px-6 py-4 font-medium text-[#1d1d1f]">{feat}</td>
                      {plans.map((p) => (
                        <td
                          key={p.id}
                          className={`px-5 py-4 text-center ${p.highlight ? "bg-[#fff8f5]" : ""}`}
                        >
                          <FeatureCell value={p.features[i]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Enterprise Strip */}
          <div className="mt-4 rounded-2xl border border-[#d2d2d7] px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
            <div>
              <p className="font-semibold text-[#1d1d1f] text-[15px]">Enterprise &amp; Multi-branch chains</p>
              <p className="text-sm text-[#6e6e73] mt-0.5">
                Unlimited branches, custom integrations, dedicated SLA, and an account manager.
              </p>
            </div>
            <Link
              href="/contact"
              className="shrink-0 inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold border border-[#d2d2d7] text-[#1d1d1f] rounded-xl hover:border-[#1d1d1f] transition-colors whitespace-nowrap"
            >
              Talk to Sales <ArrowRight size={14} />
            </Link>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-[#d2d2d7] py-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 
              className="font-bold text-[#1d1d1f] mb-3"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
            >
              Frequently asked questions
            </h2>
            <p className="text-[#6e6e73]">Everything you need to know about Dineiz pricing.</p>
          </div>

          <Accordion
            items={faqs.map((f) => ({ question: f.q, answer: f.a }))}
            className="mb-8"
          />

          {/* Still have questions? */}
          <div className="flex items-center justify-between gap-4 p-6 bg-[#f5f5f7] rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white border border-[#d2d2d7] shadow-sm flex items-center justify-center shrink-0">
                <MessageSquare size={18} className="text-[#1d1d1f]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1d1d1f]">Still have questions?</div>
                <div className="text-[13px] text-[#6e6e73] mt-0.5">WhatsApp us — we respond within minutes.</div>
              </div>
            </div>
            <a
              href="https://wa.me/923001234567"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-5 py-2.5 text-xs font-semibold bg-[#1d1d1f] text-white rounded-lg hover:bg-black transition-colors"
            >
              WhatsApp Us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
