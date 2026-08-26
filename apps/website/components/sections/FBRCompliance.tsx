"use client";
import { Receipt } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    title: "Dual GST Rates",
    desc: "Set separate GST rates for cash and card/digital payments per branch. The rate applied is recalculated on the server at checkout, never trusted from the client.",
  },
  {
    title: "Sindh Revenue Board Toggle",
    desc: "Branches registered with SRB can enable SRB tax handling from Settings — no extra configuration.",
  },
  {
    title: "NTN On Every Receipt",
    desc: "Your registered NTN is printed on customer bills and paid receipts automatically.",
  },
  {
    title: "Exportable Tax Summaries",
    desc: "Generate monthly GST summary reports from Dineiz Console for your own filing and record-keeping.",
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
              <Receipt size={13} />
              Built for Pakistani Tax Rules
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              GST handled the way<br />your restaurant needs it
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Configure your cash and card GST rates once, and Dineiz applies them automatically at checkout. Every receipt carries your NTN, and SRB-registered branches can turn on SRB handling with a single toggle.
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
              <div className="border-t border-dashed border-gray-200 pt-3 text-center">
                <div className="text-gray-400 text-xs">Thank you for dining with us</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
