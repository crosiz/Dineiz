"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const products = [
  {
    tagline: "Full-service billing terminal",
    name: "Dineiz POS",
    description:
      "Tablet-based POS for dine-in restaurants with table management, kitchen display, GST receipt printing, and multi-payment support.",
    href: "/product/pos",
    features: ["Table & takeaway modes", "Itemized GST receipts", "KDS integration", "Split bills & discounts"],
  },
  {
    tagline: "Mobile app for on-the-go",
    name: "Dineiz Go",
    description:
      "Native Android app for food carts and counter-service restaurants. Runs on any Android phone — no expensive hardware needed.",
    href: "/product/go",
    features: ["Android phone & tablet", "Counter & cart mode", "Offline first", "Instant digital receipt"],
  },
  {
    tagline: "Owner analytics dashboard",
    name: "Dineiz Console",
    description:
      "Web-based dashboard for restaurant owners and managers. Monitor sales, staff, inventory, and branch performance from anywhere.",
    href: "/product/console",
    features: ["Multi-branch view", "Real-time analytics", "Staff reports", "Export to Excel"],
  },
];

export function ProductCards() {
  return (
    <section className="bg-[#f5f5f7] py-24 lg:py-32 border-y border-[#d2d2d7]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-brand-700 tracking-wide mb-4">Products</p>
          <h2
            className="font-bold text-[#1d1d1f] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            One ecosystem, three products.
          </h2>
          <p className="text-[#6e6e73] text-lg max-w-xl mx-auto">
            Whether you run a single restaurant or a multi-branch chain, Dineiz has the right product for you.
          </p>
        </div>

        {/* Columns */}
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#d2d2d7]">
          {products.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="py-10 md:py-0 first:pt-0 md:px-10 first:md:pl-0 last:md:pr-0"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-700 mb-4">
                {p.tagline}
              </p>
              <h3 className="text-[26px] font-bold text-[#1d1d1f] mb-4 tracking-tight">
                {p.name}
              </h3>
              <p className="text-[#6e6e73] text-[15px] leading-relaxed mb-7">
                {p.description}
              </p>

              <ul className="space-y-2.5 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-[#1d1d1f]">
                    <span className="w-3 h-px bg-[#c2c2c7] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={p.href}
                aria-label={`Learn more about ${p.name}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d1d1f] border-b border-[#1d1d1f] pb-0.5 hover:text-brand-700 hover:border-brand-700 transition-colors"
              >
                Learn more about {p.name}
                <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
