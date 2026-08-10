"use client";
import { motion } from "framer-motion";

const steps = [
  {
    step: "01",
    title: "Sign up in 2 minutes",
    desc: "Create your Dineiz account with just a phone number. No contracts, no hardware purchase required.",
  },
  {
    step: "02",
    title: "Add your menu",
    desc: "Add categories, items, and prices. Import from an existing list or let our team set it up — free of charge.",
  },
  {
    step: "03",
    title: "Start billing",
    desc: "Open the app on any device, connect your printer, and begin taking orders. Average setup: 14 minutes.",
  },
  {
    step: "04",
    title: "Grow with data",
    desc: "Use Dineiz Console to monitor sales, track staff, and make decisions backed by real numbers every day.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-4">Getting Started</p>
          <h2
            className="font-bold text-[#1d1d1f]"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Up and running in under 15 minutes.
          </h2>
        </div>

        <div className="relative">
          {/* Connecting line — desktop only */}
          <div className="hidden md:block absolute top-[19px] left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-[#e5e5ea]" />

          <div className="grid md:grid-cols-4 gap-10">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="relative text-center"
              >
                <div className="relative z-10 w-12 h-12 rounded-full bg-[#f5f5f7] border border-[#d2d2d7] flex items-center justify-center mx-auto mb-6">
                  <span className="text-sm font-bold text-[#1d1d1f]">{s.step}</span>
                </div>
                <h3 className="text-lg font-bold text-[#1d1d1f] mb-3">{s.title}</h3>
                <p className="text-[15px] text-[#6e6e73] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
