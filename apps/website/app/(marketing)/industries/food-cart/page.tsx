import React from "react";
import { generateSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { Smartphone, MessageCircle, Wallet, DownloadCloud, Store } from "lucide-react";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata = generateSEOMetadata({
  title: 'Food Cart Billing App Pakistan — Free POS for Street Food',
  description: 'The best free billing app for food carts and street food in Pakistan. No printer needed—send receipts via WhatsApp. Accept JazzCash easily. 100% Free.',
  keywords: ['food cart billing Pakistan', 'street food billing app', 'thela billing software', 'mobile POS Pakistan'],
  canonical: 'https://dineiz.com/industries/food-cart',
});

// JSON-LD for Food Cart page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dineiz Go Mobile",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Android",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "PKR",
    "description": "100% free billing app for street food and carts."
  },
  "audience": {
    "@type": "Audience",
    "audienceType": "Food cart, thela, and street food vendors in Pakistan"
  }
};

export const dynamic = 'force-static';

export default function FoodCartPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* HERO SECTION */}
      <section className="bg-white pt-[120px] pb-[80px] min-h-[70vh] flex flex-col items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-[13px] font-bold tracking-wide mb-8">
            <Store size={14} /> 100% Free Forever
          </div>
          
          <h1 className="text-[48px] md:text-[64px] font-extrabold text-[#1d1d1f] leading-[1.1] tracking-tight mb-6">
            Apne mobile ko <span className="text-[#FF6B35]">cash counter</span> banayein.
          </h1>
          
          <p className="text-[20px] text-[#6e6e73] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
            No expensive hardware. No printers needed. Send digital receipts via WhatsApp and accept JazzCash instantly on your Android phone.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-[#FF6B35] text-white rounded-full font-bold text-[16px] shadow-sm hover:bg-[#e65a25] transition-colors"
            >
              Download Free App
            </Link>
          </div>
        </div>
      </section>

      {/* ULTRA-PRACTICAL FEATURES */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight">Everything you need, nothing you don't.</h2>
            <p className="text-[#6e6e73] text-[18px] max-w-2xl mx-auto">We stripped away the complex features. Dineiz Go is built for speed, making it perfect for fast-paced street food stalls.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
            {/* WhatsApp Feature */}
            <div className="bg-white rounded-2xl p-8 border border-[#d2d2d7] flex flex-col h-full">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <MessageCircle size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-2">WhatsApp Receipts</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed mb-8 flex-grow">
                Don't waste money on a receipt printer or paper rolls. Generate a beautiful digital bill and send it directly to your customer's WhatsApp in one tap.
              </p>
              {/* Mini mockup */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-auto">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"><MessageCircle size={16} className="text-white" /></div>
                  <div className="text-sm font-bold text-[#1d1d1f]">WhatsApp</div>
                </div>
                <div className="bg-[#E7FFDB] rounded-lg rounded-tl-none p-3 text-[13px] text-gray-800 shadow-sm inline-block">
                  Your bill from Burger Cart: Rs 450. <br/><span className="text-blue-500 underline">dineiz.com/r/8f2a</span>
                </div>
              </div>
            </div>

            {/* Any Phone Feature */}
            <div className="bg-white rounded-2xl p-8 border border-[#d2d2d7] flex flex-col h-full">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <Smartphone size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-2">Works on Any Android</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed mb-8 flex-grow">
                You don't need an iPad or a heavy terminal. Dineiz Go runs flawlessly on any basic Android phone (Android 7+ with 2GB RAM).
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-auto flex items-center justify-between">
                <span className="font-bold text-[13px] text-[#1d1d1f]">Storage Required</span>
                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">Only 15 MB</span>
              </div>
            </div>

            {/* Digital Payments Feature */}
            <div className="bg-white rounded-2xl p-8 border border-[#d2d2d7] flex flex-col h-full">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <Wallet size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1d1d1f] mb-2">JazzCash & EasyPaisa</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed mb-8 flex-grow">
                Customers don't have exact change? No problem. Record digital payments directly in the app so your daily total is always 100% accurate.
              </p>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mt-auto flex justify-around">
                <div className="text-center">
                  <div className="font-bold text-[#1d1d1f]">Rs 4,500</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cash</div>
                </div>
                <div className="w-px bg-gray-300"></div>
                <div className="text-center">
                  <div className="font-bold text-[#FF6B35]">Rs 1,200</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">JazzCash</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* NO WIFI NO PROBLEM */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            
            <div className="order-last md:order-first">
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-red-100 text-red-600 border border-red-200 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> Offline Mode
                </div>
                <div className="space-y-4 mt-8">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="font-medium text-gray-500">Zinger Burger</span>
                    <span className="font-bold text-[#1d1d1f]">Rs 350</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="font-medium text-gray-500">Fries (Large)</span>
                    <span className="font-bold text-[#1d1d1f]">Rs 150</span>
                  </div>
                  <button className="w-full bg-[#1d1d1f] text-white font-bold py-3 rounded-xl mt-4">
                    Save Order
                  </button>
                </div>
                <div className="text-center mt-4 text-xs text-gray-400 flex items-center justify-center gap-1 font-medium">
                  <DownloadCloud size={14} /> Will sync when online
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-6 tracking-tight">Works without internet.</h2>
              <p className="text-[18px] text-[#6e6e73] mb-8 leading-relaxed">
                We know that 4G on the street isn't always reliable. Dineiz Go features a robust <strong className="text-[#1d1d1f]">Offline Mode</strong>. Keep taking orders, keep printing bills, and keep serving customers even when your data connection drops. 
              </p>
              <p className="text-[18px] text-[#6e6e73] leading-relaxed">
                The app automatically syncs all your orders securely to the cloud the moment your internet reconnects.
              </p>
            </div>

          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <InternalLinks currentPath="/industries/food-cart" />
      </div>
      <FinalCTASection />
    </>
  );
}

