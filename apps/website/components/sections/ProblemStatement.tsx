"use client";
import { X, Check } from "lucide-react";
import { motion } from "framer-motion";

const before = [
  "Manual paper receipts — errors daily",
  "No FBR tax compliance",
  "Cash only — losing JazzCash orders",
  "No visibility into daily sales",
  "Staff theft goes undetected",
  "WhatsApp orders tracked on a notepad",
];

const after = [
  "Digital FBR receipts printed instantly",
  "Automatic GST calculation and filing",
  "JazzCash, EasyPaisa, and card accepted",
  "Live dashboard with hourly sales reports",
  "Role-based access and full audit trail",
  "WhatsApp AI takes orders automatically",
];

export function ProblemStatement() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-4">The Problem</p>
          <h2
            className="font-bold text-[#1d1d1f]"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Running a restaurant is hard.<br className="hidden sm:block" />
            Dineiz makes it simple.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="border border-[#d2d2d7] rounded-2xl overflow-hidden bg-white"
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e5e5ea]">
              <span className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-[#d2d2d7] flex items-center justify-center">
                <X size={12} className="text-[#6e6e73]" strokeWidth={2.5} />
              </span>
              <span className="text-sm font-semibold text-[#6e6e73]">Without Dineiz</span>
            </div>
            <ul>
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3 px-5 py-3.5 border-b border-[#f5f5f7] last:border-0">
                  <X size={14} className="text-[#d2d2d7] mt-0.5 shrink-0" strokeWidth={2} />
                  <span className="text-sm text-[#6e6e73]">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="border border-[#d2d2d7] rounded-2xl overflow-hidden bg-white"
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e5e5ea]">
              <span className="w-6 h-6 rounded-full bg-[#fff4ef] border border-[#ffc9b0] flex items-center justify-center">
                <Check size={12} className="text-[#FF6B35]" strokeWidth={2.5} />
              </span>
              <span className="text-sm font-semibold text-[#1d1d1f]">With Dineiz</span>
            </div>
            <ul>
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3 px-5 py-3.5 border-b border-[#f5f5f7] last:border-0">
                  <Check size={14} className="text-[#FF6B35] mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-[#1d1d1f]">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
