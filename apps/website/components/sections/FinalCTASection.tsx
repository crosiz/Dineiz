"use client";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-5">
          Get started today
        </p>
        <h2
          className="font-bold text-[#1d1d1f] mb-5"
          style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
        >
          Ready to transform your restaurant?
        </h2>
        <p className="text-[#6e6e73] text-lg mb-10 max-w-lg mx-auto leading-relaxed">
          Join 500+ restaurants across Pakistan. 14-day free trial, no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 items-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-[15px] font-semibold bg-[#FF6B35] text-white rounded-full hover:bg-[#e65a25] transition-colors"
          >
            Start Free Trial
            <ArrowRight size={15} />
          </Link>
          <a
            href="https://wa.me/923001234567?text=Dineiz%20ka%20demo%20chahiye"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-[15px] font-semibold border border-[#d2d2d7] text-[#1d1d1f] rounded-full hover:border-[#1d1d1f] transition-colors"
          >
            <MessageCircle size={15} />
            WhatsApp Us
          </a>
        </div>
        <p className="mt-6 text-sm text-[#6e6e73]">
          Free trial · No credit card · Cancel anytime
        </p>
      </div>
    </section>
  );
}
