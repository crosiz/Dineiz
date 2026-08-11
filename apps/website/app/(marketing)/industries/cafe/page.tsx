import React from "react";
import { generateSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { QrCode, Heart, Palette, Smartphone, Coffee, Star, Check } from "lucide-react";
import { FinalCTASection } from "@/components/sections/FinalCTASection";

export const metadata = generateSEOMetadata({
  title: 'Café POS Pakistan — Dineiz Coffee Shop Billing Software',
  description: 'Elevate your café experience with Dineiz. QR ordering, loyalty programs, and beautiful digital receipts. Perfect for coffee shops across Pakistan.',
  keywords: ['café POS Pakistan', 'coffee shop billing system Pakistan', 'café management software', 'QR menu Pakistan'],
  canonical: 'https://dineiz.com/industries/cafe',
});

// JSON-LD for Cafe page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dineiz Cafe",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, Android, iOS",
  "offers": {
    "@type": "Offer",
    "price": "2999",
    "priceCurrency": "PKR",
    "description": "Premium POS software for cafes and coffee shops in Pakistan."
  },
  "audience": {
    "@type": "Audience",
    "audienceType": "Cafe and coffee shop owners in Pakistan"
  }
};

export default function CafePage() {
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
            <Coffee size={14} /> For Coffee Shops & Cafés
          </div>
          
          <h1 className="text-[48px] md:text-[64px] font-extrabold text-[#1d1d1f] leading-[1.1] tracking-tight mb-6">
            An experience as crafted as your <span className="text-[#FF6B35]">coffee.</span>
          </h1>
          
          <p className="text-[20px] text-[#6e6e73] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
            Your ambiance is perfect. Your POS should be too. Bring QR ordering, digital loyalty, and stunning branded receipts to your café.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-[#FF6B35] text-white rounded-full font-bold text-[16px] shadow-sm hover:bg-[#e65a25] transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-4 bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-full font-bold text-[16px] hover:border-[#1d1d1f] transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ASPIRATIONAL FEATURE GRID */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid md:grid-cols-2 gap-16 lg:gap-24">
            
            <div className="flex flex-col justify-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mb-6">
                <QrCode size={24} className="text-[#1d1d1f]" />
              </div>
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
                QR Ordering from the table.
              </h2>
              <p className="text-[18px] text-[#6e6e73] leading-relaxed mb-6">
                Don't make customers interrupt their conversations to order a second latte. They can scan the beautiful QR code on their table, view your menu, and order instantly.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-[#1d1d1f] font-medium"><Star size={16} className="text-[#FF6B35]" /> Instant digital menu updates</li>
                <li className="flex items-center gap-3 text-[#1d1d1f] font-medium"><Star size={16} className="text-[#FF6B35]" /> Customers can request the bill digitally</li>
                <li className="flex items-center gap-3 text-[#1d1d1f] font-medium"><Star size={16} className="text-[#FF6B35]" /> Increase average order value by 15%</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-2xl p-8 flex items-center justify-center relative overflow-hidden border border-[#d2d2d7]">
              {/* Minimalist QR Mockup */}
              <div className="relative w-64 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-[#1d1d1f] text-white text-center py-6">
                  <div className="text-xl font-bold mb-1">Café Artisan</div>
                  <div className="text-xs text-gray-300">Scan to order</div>
                </div>
                <div className="p-8 flex justify-center bg-white">
                  <div className="w-40 h-40 border-4 border-[#1d1d1f] rounded-xl flex items-center justify-center">
                    <QrCode size={100} className="text-[#1d1d1f]" />
                  </div>
                </div>
                <div className="bg-gray-50 text-center py-4 text-sm font-medium text-gray-500">
                  Table 04
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 flex items-center justify-center relative overflow-hidden border border-[#d2d2d7] order-last md:order-none">
              {/* Minimalist Receipt Mockup */}
              <div className="relative w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 text-center border-b border-dashed border-gray-300">
                  <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <Coffee size={24} className="text-[#1d1d1f]" />
                  </div>
                  <div className="text-xl font-bold text-[#1d1d1f]">Café Artisan</div>
                  <div className="text-xs text-gray-400 mt-1">DHA Phase 6, Lahore</div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-600">2x Spanish Latte</span>
                    <span className="font-medium text-[#1d1d1f]">Rs 1200</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-600">1x Almond Croissant</span>
                    <span className="font-medium text-[#1d1d1f]">Rs 650</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between">
                    <span className="font-bold text-[#1d1d1f]">Total</span>
                    <span className="font-bold text-[#1d1d1f]">Rs 1850</span>
                  </div>
                </div>
                <div className="bg-[#1d1d1f] text-white text-center py-3 text-xs font-medium">
                  Scan QR below for 10% off next visit
                </div>
              </div>
            </div>
            
            <div className="flex flex-col justify-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mb-6">
                <Palette size={24} className="text-[#1d1d1f]" />
              </div>
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
                Branded to perfection.
              </h2>
              <p className="text-[18px] text-[#6e6e73] leading-relaxed mb-6">
                Your brand is everything. Customize your printed receipts and digital invoices with your exact logo, typography, and Instagram handle to create a memorable unboxing experience for your takeaway cups.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center mb-6">
                <Heart size={24} className="text-[#1d1d1f]" />
              </div>
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
                Turn walk-ins into regulars.
              </h2>
              <p className="text-[18px] text-[#6e6e73] leading-relaxed mb-6">
                Launch a digital loyalty program instantly. "Buy 4 coffees, get the 5th free." Customers don't need a paper punch card; Dineiz tracks their purchases via their phone number effortlessly.
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-8 flex items-center justify-center relative overflow-hidden border border-[#d2d2d7]">
               {/* Minimalist Loyalty Mockup */}
               <div className="relative w-72 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-6">Loyalty Status</div>
                <div className="w-20 h-20 bg-gray-50 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-3xl font-bold text-[#1d1d1f]">4<span className="text-lg text-gray-400">/5</span></span>
                </div>
                <div className="text-[#1d1d1f] font-bold text-lg mb-1">Almost there!</div>
                <div className="text-sm text-gray-500">1 more coffee for a free pastry.</div>
                <div className="mt-6 flex justify-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center"><Check size={16} /></div>
                  <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center"><Check size={16} /></div>
                  <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center"><Check size={16} /></div>
                  <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center"><Check size={16} /></div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">5</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DINEIZ GO SECTION */}
      <section className="bg-white py-24 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Smartphone size={48} className="text-[#1d1d1f] mx-auto mb-8" />
          <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-6 tracking-tight">Small café? Start with Dineiz Go.</h2>
          <p className="text-[18px] text-[#6e6e73] max-w-2xl mx-auto mb-10 leading-relaxed">
            Just opening your first espresso bar? You don't need a bulky register. Download the free Dineiz Go app on any tablet or phone, connect a sleek Bluetooth printer, and start taking orders instantly.
          </p>
          <Link
            href="/product/go"
            className="inline-block px-8 py-4 bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-full font-bold text-[16px] shadow-sm hover:border-[#1d1d1f] transition-colors"
          >
            Explore Dineiz Go
          </Link>
        </div>
      </section>

      <FinalCTASection />
    </>
  );
}
