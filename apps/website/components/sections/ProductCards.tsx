"use client";
import Link from "next/link";
import { Monitor, Smartphone, LayoutDashboard, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const products = [
  {
    icon: Monitor,
    name: "Dineiz POS",
    tagline: "Full-service billing terminal",
    description:
      "Tablet-based POS for dine-in restaurants with table management, kitchen display, FBR receipt printing, and multi-payment support.",
    href: "/product/pos",
    features: ["Table & takeaway modes", "FBR receipt with QR code", "KDS integration", "JazzCash & EasyPaisa"],
  },
  {
    icon: Smartphone,
    name: "Dineiz Go",
    tagline: "Mobile app for on-the-go",
    description:
      "Native Android app for food carts and counter-service restaurants. Runs on any Android phone — no expensive hardware needed.",
    href: "/product/go",
    features: ["Android phone & tablet", "Counter & cart mode", "Offline first", "Instant digital receipt"],
  },
  {
    icon: LayoutDashboard,
    name: "Dineiz Console",
    tagline: "Owner analytics dashboard",
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
          <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-4">Products</p>
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

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-[#d2d2d7] flex flex-col overflow-hidden hover:border-[#1d1d1f] transition-colors"
              >
                <div className="p-8 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-6">
                    <Icon size={22} className="text-[#1d1d1f]" />
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#FF6B35] mb-2">
                    {p.tagline}
                  </div>
                  <h3 className="text-2xl font-bold text-[#1d1d1f] mb-4 tracking-tight">{p.name}</h3>
                  <p className="text-[15px] text-[#6e6e73] leading-relaxed mb-6">{p.description}</p>
                  
                  <div className="h-px w-full bg-[#f5f5f7] mb-6" />
                  
                  <ul className="space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-[14px] text-[#1d1d1f] font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#1d1d1f] shrink-0 opacity-80" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href={p.href}
                    className="inline-flex items-center justify-center w-full py-3.5 bg-[#f5f5f7] rounded-xl text-sm font-semibold text-[#1d1d1f] hover:bg-[#e5e5ea] transition-colors"
                  >
                    Learn more
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
