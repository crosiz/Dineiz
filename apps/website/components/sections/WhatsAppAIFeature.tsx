"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

const messages = [
  { from: "customer", text: "Assalamualaikum, 2 biryani aur 1 doodh pati chaiye" },
  { from: "bot", text: "Wa alaikum salam! Aapka order confirm kar raha hoon:\n• 2× Biryani Full — Rs. 800\n• 1× Doodh Pati — Rs. 60\n\nTotal: Rs. 860\n\nDeliver karein ya khud lene aayenge? 🍛" },
  { from: "customer", text: "Delivery please, Gulshan Block 6" },
  { from: "bot", text: "Shukriya! Aapka order kitchen ko bhej diya. Estimated time: 35 minutes.\n\nPayment: JazzCash ya EasyPaisa pe Rs. 860 transfer karein:\n📱 0300-1234567\n\nOrder ID: #DNZ-4821" },
];

export function WhatsAppAIFeature() {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= messages.length) return;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), 1800);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  return (
    <section className="bg-gray-50 border-y border-gray-100 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              WhatsApp AI Ordering
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Your AI waiter that<br />never sleeps
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Dineiz AI reads WhatsApp messages from customers — in Roman Urdu or English — and handles the entire ordering flow automatically. Confirmation, payment, and kitchen routing without any staff involvement.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Works 24/7 — even when you're closed",
                "Understands Roman Urdu naturally",
                "Sends JazzCash / EasyPaisa payment link",
                "Routes order directly to kitchen display",
                "Zero per-order cost",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <Check size={16} className="text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/product/whatsapp"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Learn about WhatsApp AI
            </a>
          </div>

          {/* Right: WhatsApp chat mockup */}
          <div className="relative">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-card-lg overflow-hidden max-w-sm mx-auto">
              {/* WhatsApp header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-green-600">
                <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center text-white text-sm font-bold">
                  D
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Dineiz Restaurant Bot</div>
                  <div className="text-xs text-green-200">Online</div>
                </div>
              </div>

              {/* Chat body */}
              <div className="bg-[#e5ddd5] p-4 space-y-3 min-h-[320px]">
                {messages.slice(0, visibleCount).map((msg, i) => (
                  <AnimatePresence key={i}>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                          msg.from === "customer"
                            ? "bg-[#dcf8c6] text-gray-800 rounded-tr-sm"
                            : "bg-white text-gray-800 rounded-tl-sm shadow-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                ))}
                {visibleCount < messages.length && (
                  <div className="flex justify-start">
                    <div className="bg-white px-3 py-2 rounded-xl rounded-tl-sm shadow-sm">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
