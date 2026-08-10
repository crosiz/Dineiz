"use client";
import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export function HeroSection() {
  return (
    <section className="bg-white pt-16 pb-24 lg:pt-24 lg:pb-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold text-brand-500 tracking-wide mb-6 text-center"
        >
          The Best POS in Pakistan & MENA
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-center font-bold tracking-tight text-[#1d1d1f] mb-6"
          style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", lineHeight: 1.05, letterSpacing: "-0.04em" }}
        >
          The smarter way to<br />run your restaurant.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="text-center text-[#6e6e73] text-lg leading-relaxed max-w-2xl mx-auto mb-10"
        >
          Complete POS, billing, kitchen display, analytics, and WhatsApp ordering — 
          with FBR compliance and local payments built in.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18 }}
          className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14"
        >
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#FF6B35] text-white text-[15px] font-semibold rounded-full hover:bg-[#e65a25] transition-colors"
          >
            Start Free Trial
            <ArrowRight size={15} />
          </Link>
          <a
            href="https://wa.me/923001234567?text=Hi%2C%20I%27d%20like%20a%20demo%20of%20Dineiz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-[#1d1d1f] text-[15px] font-semibold rounded-full border border-[#d2d2d7] hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
          >
            <MessageCircle size={15} />
            Book a Demo
          </a>
        </motion.div>

        {/* Product mockup */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-2xl border border-[#d2d2d7] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.07)]"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 bg-[#f5f5f7] border-b border-[#d2d2d7]">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <div className="ml-3 flex-1 max-w-xs bg-white border border-[#d2d2d7] rounded-md px-3 py-1 text-xs text-[#6e6e73] font-mono">
              pos.dineiz.com
            </div>
          </div>

          {/* POS interface */}
          <div className="grid md:grid-cols-[1fr_260px] bg-[#f5f5f7]">
            {/* Left — order items */}
            <div className="p-5 border-r border-[#d2d2d7]">
              <div className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-4">
                Table 7 — Dine In
              </div>
              <div className="space-y-2">
                {[
                  { name: "Chicken Biryani — Full", qty: 2, price: "Rs. 800" },
                  { name: "Seekh Kabab (4 pcs)", qty: 1, price: "Rs. 340" },
                  { name: "Chicken Karahi", qty: 1, price: "Rs. 950" },
                  { name: "Naan", qty: 6, price: "Rs. 120" },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between bg-white border border-[#e5e5ea] rounded-xl px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-[#FF6B35] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {item.qty}
                      </span>
                      <span className="text-sm font-medium text-[#1d1d1f]">{item.name}</span>
                    </div>
                    <span className="text-sm text-[#6e6e73]">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — bill */}
            <div className="p-5 bg-white flex flex-col">
              <div className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-widest mb-4">Order Total</div>
              <div className="space-y-2.5 flex-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6e6e73]">Subtotal</span>
                  <span className="font-medium text-[#1d1d1f]">Rs. 2,210</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6e6e73]">GST (17%)</span>
                  <span className="font-medium text-[#1d1d1f]">Rs. 376</span>
                </div>
                <div className="h-px bg-[#e5e5ea] my-1" />
                <div className="flex justify-between text-base font-bold text-[#1d1d1f]">
                  <span>Total</span>
                  <span>Rs. 2,586</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-[#6e6e73] bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg px-3 py-2">
                  FBR Receipt — Auto-generated
                </div>
                <button className="w-full py-3 bg-[#FF6B35] text-white text-sm font-semibold rounded-xl hover:bg-[#e65a25] transition-colors">
                  Print Receipt &amp; Charge
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-center text-sm text-[#6e6e73] mt-6"
        >
          No credit card required · 14-day free trial · Setup in 14 minutes
        </motion.p>
      </div>
    </section>
  );
}
