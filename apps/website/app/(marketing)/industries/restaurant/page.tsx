import React from "react";
import { generateSEOMetadata } from "@/lib/seo";
import Link from "next/link";
import { BarChart3, ShieldCheck, LayoutGrid, Tablet, CheckCircle2 } from "lucide-react";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { InternalLinks } from "@/components/seo/InternalLinks";

export const metadata = generateSEOMetadata({
  title: 'Restaurant POS Pakistan — Dineiz Management Software',
  description: 'The premier restaurant POS and management software in Pakistan. Prevent theft, manage tables, run KDS, and track real-time analytics. Multi-branch ready.',
  keywords: ['restaurant POS Pakistan', 'restaurant management software Pakistan', 'multi branch POS system', 'GST restaurant POS Pakistan'],
  canonical: 'https://dineiz.com/industries/restaurant',
});

// JSON-LD for Restaurant page
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dineiz Pro",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, Android, iOS",
  "offers": {
    "@type": "Offer",
    "price": "2999",
    "priceCurrency": "PKR",
    "description": "Starter plan for single location restaurants."
  },
  "audience": {
    "@type": "Audience",
    "audienceType": "Mid-to-large restaurants and multi-branch chains in Pakistan"
  }
};

export const dynamic = 'force-static';

export default function RestaurantPage() {
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
            For Growing Restaurants
          </div>
          
          <h1 className="text-[48px] md:text-[64px] font-extrabold text-[#1d1d1f] leading-[1.1] tracking-tight mb-6">
            The POS system that <span className="text-[#FF6B35]">pays for itself.</span>
          </h1>
          
          <p className="text-[20px] text-[#6e6e73] font-medium leading-relaxed max-w-2xl mx-auto mb-10">
            Stop cash leakage. Automate your kitchen. Scale to multiple branches. Our theft-prevention controls catch discrepancies before they become a habit.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-[#FF6B35] text-white rounded-full font-bold text-[16px] shadow-sm hover:bg-[#e65a25] transition-colors"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE DEPTH */}
      <section className="bg-[#f5f5f7] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight">
              Engineered for control & efficiency.
            </h2>
            <p className="text-[#6e6e73] text-[18px] max-w-2xl mx-auto">
              When your monthly revenue crosses PKR 500,000, you cannot rely on guesswork. Dineiz provides enterprise-grade tools for independent restaurants.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-2xl border border-[#d2d2d7]">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="font-bold text-[18px] text-[#1d1d1f] mb-2">Shift Reconciliation</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed">Ensure every rupee matches the drawer. Role-based PINs prevent staff from unauthorized voids or discounts.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#d2d2d7]">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <LayoutGrid size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="font-bold text-[18px] text-[#1d1d1f] mb-2">Table Management</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed">Visual floor plans. Track table duration, merge bills, and split payments effortlessly during rush hour.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#d2d2d7]">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <Tablet size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="font-bold text-[18px] text-[#1d1d1f] mb-2">Kitchen Display (KDS)</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed">Route orders instantly to the kitchen. Color-coded ticket times prevent delayed orders and angry customers.</p>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-[#d2d2d7]">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 size={24} className="text-[#1d1d1f]" />
              </div>
              <h3 className="font-bold text-[18px] text-[#1d1d1f] mb-2">Real-time Analytics</h3>
              <p className="text-[15px] text-[#6e6e73] leading-relaxed">Track inventory depletion, best-selling items, and peak hours from anywhere in the world on your phone.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING PLANS */}
      <section className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <h2 className="text-[32px] md:text-[40px] font-bold text-[#1d1d1f] mb-4 tracking-tight">Choose your scale.</h2>
            <p className="text-[#6e6e73] text-[18px]">Transparent pricing. No setup fees.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl p-8 border border-[#d2d2d7] flex flex-col h-full">
              <div className="mb-8">
                <h3 className="text-[12px] font-bold text-[#6e6e73] uppercase tracking-widest mb-4">Starter</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-[16px] font-semibold text-gray-500">Rs</span>
                  <span className="text-[48px] font-extrabold text-[#1d1d1f] tracking-tight leading-none">2,999</span>
                  <span className="text-[15px] font-medium text-gray-500">/mo</span>
                </div>
                <p className="text-[15px] text-gray-500">For single-location restaurants.</p>
              </div>
              
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Tablet POS Terminal</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Web Admin Dashboard</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Kitchen Display (KDS)</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Table Management</li>
              </ul>

              <Link
                href="/signup"
                className="block text-center py-4 bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-xl font-bold text-[15px] hover:border-[#1d1d1f] transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl p-8 border border-[#FF6B35] shadow-[0_8px_32px_rgba(255,107,53,0.08)] flex flex-col h-full">
              <div className="mb-8">
                <h3 className="text-[12px] font-bold text-[#FF6B35] uppercase tracking-widest mb-4">
                  Pro (Most Popular)
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-[16px] font-semibold text-gray-500">Rs</span>
                  <span className="text-[48px] font-extrabold text-[#1d1d1f] tracking-tight leading-none">5,999</span>
                  <span className="text-[15px] font-medium text-gray-500">/mo</span>
                </div>
                <p className="text-[15px] text-gray-500">For restaurants expanding to new locations.</p>
              </div>
              
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Everything in Starter</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Up to 3 Branches</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Full Inventory & Recipes</li>
                <li className="flex items-center gap-3 text-[15px] text-[#1d1d1f]"><CheckCircle2 size={18} className="text-[#FF6B35]" /> Customer CRM</li>
              </ul>

              <Link
                href="/signup"
                className="block text-center py-4 bg-[#FF6B35] text-white rounded-xl font-bold text-[15px] hover:bg-[#e65a25] transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <InternalLinks currentPath="/industries/restaurant" />
      </div>
      <FinalCTASection />
    </>
  );
}

