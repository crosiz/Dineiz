import React from "react";
import { generateSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { Smartphone, Printer, Receipt, ArrowRight, CheckCircle2, TrendingUp, Users } from "lucide-react";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata = generateSEOMetadata({
  title: 'Dhaba Billing Software Pakistan — Dineiz Free App',
  description: 'Billing software for dhabas in Pakistan. Download free. Works on any Android phone. Bluetooth printer support. No monthly fee.',
  keywords: ['dhaba billing software', 'dhaba POS Pakistan', 'dhaba billing app free', 'road dhaba billing system'],
  canonical: 'https://dineiz.com/industries/dhaba',
});

// JSON-LD for Dhaba page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dineiz Go",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Android 7.0+",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "PKR",
    "description": "Free forever plan for local dhabas in Pakistan."
  },
  "audience": {
    "@type": "Audience",
    "audienceType": "Dhaba and small restaurant owners in Pakistan"
  }
};

export const dynamic = 'force-static';

export default function DhabaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* HERO SECTION */}
      <section className="bg-white pt-[120px] pb-[80px] min-h-[70vh] flex flex-col items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <h1 className="text-[48px] md:text-[64px] font-extrabold text-[#1d1d1f] leading-[1.1] tracking-tight mb-6">
            Pakistan ke har dhabe ke liye <span className="text-[#FF6B35]">smart billing.</span>
          </h1>
          
          <p className="text-[20px] text-[#6e6e73] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
            Download free. Connect a Bluetooth printer. Take your first order in 10 minutes. No training needed.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-[#FF6B35] text-white rounded-full font-bold text-[16px] shadow-sm hover:bg-[#e65a25] transition-colors"
            >
              Get Dineiz Go — Free
            </Link>
            <p className="text-sm text-gray-500 sm:hidden">No credit card required</p>
          </div>
        </div>
      </section>

      {/* 3-STEP VISUAL */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight">It is exactly this simple.</h2>
            <p className="text-[18px] text-[#6e6e73]">You don't need a laptop. You don't need expensive POS hardware.</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-[#d2d2d7] flex items-center justify-center mb-4">
                <Smartphone size={40} className="text-[#FF6B35]" />
              </div>
              <h3 className="font-bold text-[16px] text-[#1d1d1f]">Any Android Phone</h3>
              <p className="text-[13px] text-gray-500 mt-1">2GB RAM is all you need</p>
            </div>
            
            <ArrowRight className="hidden md:block text-gray-300" size={32} />
            
            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-[#d2d2d7] flex items-center justify-center mb-4">
                <Printer size={40} className="text-[#1d1d1f]" />
              </div>
              <h3 className="font-bold text-[16px] text-[#1d1d1f]">Bluetooth Printer</h3>
              <p className="text-[13px] text-gray-500 mt-1">Cheap printers from Daraz work perfectly</p>
            </div>
            
            <ArrowRight className="hidden md:block text-gray-300" size={32} />
            
            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-[#d2d2d7] flex items-center justify-center mb-4">
                <Receipt size={40} className="text-[#FF6B35]" />
              </div>
              <h3 className="font-bold text-[16px] text-[#1d1d1f]">Print Receipt</h3>
              <p className="text-[13px] text-gray-500 mt-1">Professional bill for the customer</p>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS & FEATURES */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            
            <div>
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-6 tracking-tight leading-tight">
                Puraani khata book ko choro, <br/><span className="text-[#FF6B35]">digital hisaab rakho.</span>
              </h2>
              <p className="text-[18px] text-[#6e6e73] mb-8 leading-relaxed">
                We know how hard you work. 14-hour shifts, managing staff, ensuring the khana is fresh. You shouldn't be worrying about manual ledger errors or cash going missing.
              </p>
              
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 shrink-0 mt-1">
                    <TrendingUp size={20} className="text-[#1d1d1f]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1d1d1f] text-[16px]">Daily Income Report</h4>
                    <p className="text-[15px] text-[#6e6e73] mt-1 leading-relaxed">Know exactly how much you made today, directly on your phone. No more guessing.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 shrink-0 mt-1">
                    <CheckCircle2 size={20} className="text-[#1d1d1f]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1d1d1f] text-[16px]">Simple Menu Setup</h4>
                    <p className="text-[15px] text-[#6e6e73] mt-1 leading-relaxed">Add items like Chai, Paratha, and Daal in seconds. Tap to add to bill.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 shrink-0 mt-1">
                    <Users size={20} className="text-[#1d1d1f]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1d1d1f] text-[16px]">Stop Cash Leakage</h4>
                    <p className="text-[15px] text-[#6e6e73] mt-1 leading-relaxed">Customers ask for printed receipts. Staff must punch orders to print them, so every sale is accounted for.</p>
                  </div>
                </li>
              </ul>
            </div>
            
            {/* Minimalist Mobile App Mockup Container */}
            <div className="relative">
              <div className="relative bg-white rounded-3xl p-8 shadow-xl border border-gray-200 flex flex-col justify-between h-[600px]">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                  <span className="text-[#1d1d1f] font-bold">Dineiz Go</span>
                  <span className="text-gray-500 font-medium text-xs">Table 4</span>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex justify-between">
                    <span className="text-[#1d1d1f] font-medium">2x Special Chai</span>
                    <span className="text-[#1d1d1f] font-bold">Rs 240</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex justify-between">
                    <span className="text-[#1d1d1f] font-medium">1x Aloo Paratha</span>
                    <span className="text-[#1d1d1f] font-bold">Rs 150</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex justify-between">
                    <span className="text-[#1d1d1f] font-medium">1x Daal Mash</span>
                    <span className="text-[#1d1d1f] font-bold">Rs 350</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[#1d1d1f] font-bold text-xl">Total</span>
                    <span className="text-[#1d1d1f] font-bold text-2xl">Rs 740</span>
                  </div>
                  <button className="w-full bg-[#1d1d1f] text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-colors">
                    Print Bill
                  </button>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <div>
            <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-6 tracking-tight">Start for absolutely nothing.</h2>
            <div className="inline-block bg-white border border-[#d2d2d7] rounded-[24px] p-8 sm:p-12 shadow-sm max-w-md w-full text-center">
              <div className="text-[#6e6e73] font-bold tracking-widest uppercase text-[12px] mb-4">Go Free Plan</div>
              <div className="text-6xl font-extrabold text-[#1d1d1f] tracking-tight mb-2">Rs 0<span className="text-2xl text-gray-400 font-medium tracking-normal">/mo</span></div>
              <p className="text-[15px] text-[#6e6e73] mb-8 max-w-sm mx-auto">No credit card. No hidden fees. Perfectly designed for local street-food setups.</p>
              <Link
                href="/signup"
                className="block w-full py-4 bg-[#FF6B35] text-white rounded-xl font-bold text-[15px] hover:bg-[#e65a25] transition-colors"
              >
                Create Free Account
              </Link>
            </div>
          </div>

        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <InternalLinks currentPath="/industries/dhaba" />
      </div>
      <FinalCTASection />
    </>
  );
}

