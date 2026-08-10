"use client";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    title: "FBR Certified POS",
    desc: "Dineiz is an approved FBR-integrated POS. All receipts carry a unique FBR QR code valid for tax audits.",
  },
  {
    title: "PRA & SRB Support",
    desc: "Punjab Revenue Authority and Sindh Revenue Board tax calculations are supported out of the box — no extra configuration.",
  },
  {
    title: "Automatic GST Calculation",
    desc: "GST is calculated automatically at checkout based on your registered rate. No manual math, no errors.",
  },
  {
    title: "Compliance Reports",
    desc: "Export monthly GST summary reports in FBR-accepted format for filing — directly from Dineiz Console.",
  },
];

export function FBRCompliance() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-6">
              <ShieldCheck size={13} />
              FBR Certified
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              100% FBR compliant<br />out of the box
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Don&apos;t risk fines or FBR notices. Dineiz is a certified FBR-integrated POS system, approved for use in Pakistan under the POS integration scheme. Every transaction is logged and every receipt is valid.
            </p>

            <div className="space-y-5">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="flex gap-4"
                >
                  <div className="w-1 rounded-full bg-brand-400 shrink-0 mt-1" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{f.title}</div>
                    <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: receipt mockup */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="bg-white border border-gray-200 rounded-xl shadow-card-lg p-6 max-w-xs w-full font-mono text-xs text-gray-700 space-y-1">
              <div className="text-center font-bold text-sm text-gray-900 mb-1">Jan&apos;s Broast</div>
              <div className="text-center text-gray-500 text-xs mb-1">Gulberg III, Lahore</div>
              <div className="text-center text-gray-400 text-xs mb-3">NTN: 1234567-8</div>
              <div className="border-t border-dashed border-gray-200 pt-3">
                <div className="flex justify-between"><span>Broast Half</span><span>Rs. 650</span></div>
                <div className="flex justify-between"><span>Doodh Pati ×2</span><span>Rs. 120</span></div>
                <div className="flex justify-between"><span>Naan ×4</span><span>Rs. 80</span></div>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>Rs. 850</span></div>
                <div className="flex justify-between text-gray-500"><span>GST (17%)</span><span>Rs. 145</span></div>
                <div className="flex justify-between font-bold text-gray-900 text-sm pt-1"><span>Total</span><span>Rs. 995</span></div>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-3 text-center space-y-2">
                <div className="inline-block bg-gray-100 p-2 rounded">
                  <div className="grid grid-cols-8 gap-px">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-sm ${(i * 17 + 5) % 3 === 0 ? "bg-gray-800" : "bg-white"}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-gray-400 text-xs">FBR Verified Receipt</div>
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck size={10} className="text-blue-500" />
                  <span className="text-blue-600 font-semibold text-xs">FBR#: 202412041234</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
