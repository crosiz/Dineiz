"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Smoothed 0→1 scroll progress over the first `range` px of page scroll. */
function useScrollProgress(range: number) {
  const [display, setDisplay] = useState(0);
  const targetRef = useRef(0);
  const displayRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const EPSILON = 0.0005;

    const tick = () => {
      const diff = targetRef.current - displayRef.current;
      displayRef.current += diff * 0.12;
      setDisplay(displayRef.current);
      if (Math.abs(diff) > EPSILON) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = targetRef.current;
        setDisplay(displayRef.current);
        runningRef.current = false;
      }
    };

    const startLoop = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      targetRef.current = clamp(window.scrollY / range, 0, 1);
      startLoop();
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [range]);

  return display;
}

export function HeroSection() {
  const progress = useScrollProgress(600);

  const kotY = progress * -22;
  const kotRotate = -5 + progress * -3;
  const receiptY = progress * 26;
  const receiptRotate = 3 + progress * 2.5;

  return (
    <section className="bg-white pt-16 pb-20 lg:pt-24 lg:pb-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">

          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-semibold text-brand-500 tracking-wide mb-5">
              Restaurant POS, built in Pakistan
            </p>

            <h1
              className="font-bold tracking-tight text-[#1d1d1f] mb-6"
              style={{ fontSize: "clamp(2.4rem, 4.4vw, 3.6rem)", lineHeight: 1.08, letterSpacing: "-0.03em" }}
            >
              Never lose an order to a dropped connection.
            </h1>

            <p className="text-[#6e6e73] text-lg leading-relaxed mb-9 max-w-lg">
              Billing, kitchen display, and table management in one system that keeps
              working through load-shedding — then syncs the moment you're back online,
              with GST calculated automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#FF6B35] text-white text-[15px] font-semibold rounded-full hover:bg-[#e65a25] transition-colors"
              >
                Start Free Trial
                <ArrowRight size={15} />
              </Link>
              <a
                href="https://wa.me/923141986044?text=Hi%2C%20I%27d%20like%20a%20demo%20of%20Dineiz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[#1d1d1f] text-[15px] font-semibold rounded-full border border-[#d2d2d7] hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
              >
                <MessageCircle size={15} />
                Book a Demo
              </a>
            </div>

            <p className="text-sm text-[#6e6e73]">
              No credit card required · 14-day free trial · Setup in 14 minutes
            </p>
          </motion.div>

          {/* Right — receipt + KOT ticket visual */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative h-[420px] sm:h-[460px]"
          >
            {/* Kitchen ticket — back layer */}
            <div
              style={{ transform: `translateY(${kotY}px) rotate(${kotRotate}deg)` }}
              className="absolute left-0 top-6 w-[72%] rounded-xl border border-[#d2d2d7] bg-[#fffdf7] shadow-[0_16px_40px_rgba(0,0,0,0.09)] p-5 font-mono"
            >
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed border-[#d9d4c3]">
                <span className="text-[11px] font-bold tracking-widest text-[#1d1d1f]">TABLE 7 · KOT</span>
                <span className="text-[10px] text-[#8a8467]">08:41 PM</span>
              </div>
              <ul className="space-y-2 text-[13px] text-[#3a3624]">
                <li className="flex gap-2"><span className="font-bold">2×</span> Chicken Biryani</li>
                <li className="flex gap-2"><span className="font-bold">1×</span> Seekh Kabab</li>
                <li className="flex gap-2"><span className="font-bold">1×</span> Chicken Karahi</li>
                <li className="flex gap-2"><span className="font-bold">6×</span> Naan</li>
              </ul>
            </div>

            {/* Receipt — front layer */}
            <div
              style={{ transform: `translateY(${receiptY}px) rotate(${receiptRotate}deg)` }}
              className="absolute right-0 bottom-0 w-[70%] rounded-xl border border-[#d2d2d7] bg-white shadow-[0_20px_48px_rgba(0,0,0,0.12)] p-6"
            >
              <div className="text-center mb-4">
                <div className="text-[13px] font-bold text-[#1d1d1f]">Order Total</div>
                <div className="text-[10px] text-[#9a9a9f] mt-0.5">Auto-generated receipt</div>
              </div>
              <div className="space-y-2 text-[13px] mb-4">
                <div className="flex justify-between text-[#6e6e73]">
                  <span>Subtotal</span><span className="text-[#1d1d1f] font-medium">Rs. 2,210</span>
                </div>
                <div className="flex justify-between text-[#6e6e73]">
                  <span>GST (17%)</span><span className="text-[#1d1d1f] font-medium">Rs. 376</span>
                </div>
                <div className="h-px bg-[#e5e5ea] my-1" />
                <div className="flex justify-between text-base font-bold text-[#1d1d1f]">
                  <span>Total</span><span>Rs. 2,586</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-[#6e6e73] bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg px-3 py-2 text-center">
                  GST Receipt — Auto-generated
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
