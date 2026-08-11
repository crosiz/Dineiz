"use client";

import React, { useState, useRef, useEffect } from "react";
import { PLANS } from "@/lib/plans";
import { event } from "@/lib/gtag";
import { PlanCard } from "./PlanCard";
import { ComparisonTable } from "./ComparisonTable";
import { FAQ } from "./FAQ";
import { FinalCTASection } from "../sections/FinalCTASection";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PricingClient() {
  const [isAnnual, setIsAnnual] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    event({ action: "pricing_view", category: "engagement", label: "Pricing Page Load" });
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -364 : 364; // 340px card + 24px gap
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <>
      <section className="bg-white pt-[80px] pb-[60px] w-full flex flex-col items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center w-full">
          
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF] mb-4">
            Pricing
          </span>
          <h1 className="text-[40px] md:text-[56px] font-bold text-[#0A0A0A] leading-[1.1] mb-4 text-center">
            Simple, honest pricing.
          </h1>
          <p className="text-[18px] md:text-[20px] text-[#6B7280] mb-12 text-center max-w-2xl">
            Start free. Pay when you grow. No surprises.
          </p>

          {/* Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-full mb-16 relative">
            <button
              onClick={() => setIsAnnual(false)}
              className={`relative z-10 px-6 py-2.5 text-[14px] font-semibold rounded-full transition-colors ${
                !isAnnual ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`relative z-10 flex items-center gap-2 px-6 py-2.5 text-[14px] font-semibold rounded-full transition-colors ${
                isAnnual ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Annually
              <span className="bg-green-100 text-green-700 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold">
                Save 2 months
              </span>
            </button>
            <div 
              className="absolute top-1 bottom-1 bg-white rounded-full shadow-sm transition-all duration-300 ease-out"
              style={{ 
                left: isAnnual ? "104px" : "4px",
                width: isAnnual ? "calc(100% - 108px)" : "100px"
              }}
            />
          </div>

          {/* Plan Cards Carousel */}
          <div className="w-full relative group">
            
            {/* Desktop Navigation Arrows */}
            <button 
              onClick={() => scroll("left")} 
              className="absolute -left-4 lg:-left-12 top-[45%] -translate-y-1/2 z-20 bg-white border border-gray-200 shadow-lg rounded-full p-3 text-gray-600 hover:text-black hidden md:flex transition-transform hover:scale-110 active:scale-95"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => scroll("right")} 
              className="absolute -right-4 lg:-right-12 top-[45%] -translate-y-1/2 z-20 bg-white border border-gray-200 shadow-lg rounded-full p-3 text-gray-600 hover:text-black hidden md:flex transition-transform hover:scale-110 active:scale-95"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>

            <div 
              ref={scrollRef}
              className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-12 pt-8 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 hide-scrollbar scroll-smooth"
            >
              {PLANS.map((plan, i) => (
                <div key={plan.id} className="snap-center shrink-0 w-[85vw] sm:w-[340px]">
                  <PlanCard 
                    plan={plan} 
                    billingCycle={isAnnual ? "annual" : "monthly"} 
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <ComparisonTable />
      <FAQ />
      <FinalCTASection />
    </>
  );
}
