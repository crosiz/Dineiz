import React from "react";
import { HeroSection } from "@/components/sections/HeroSection";
import { ValueStrip } from "@/components/sections/ValueStrip";
import { CoreFeatures } from "@/components/sections/CoreFeatures";
import { AudienceSolutions } from "@/components/sections/AudienceSolutions";
import { ProductCards } from "@/components/sections/ProductCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { OfflineFirst } from "@/components/sections/OfflineFirst";
import { FAQSection } from "@/components/sections/FAQSection";
import { HOMEPAGE_FAQS } from "@/lib/faqs";
import { PricingPreview } from "@/components/sections/PricingPreview";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { generateSEOMetadata, generateFAQSchema } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz — Best Restaurant POS System in Pakistan & MENA",
  description:
    "The best restaurant POS, billing software, and WhatsApp ordering system in Pakistan and MENA. Clean, minimal, and modest point of sale for food businesses.",
  path: "/",
});

export const dynamic = 'force-static';

export default function Homepage() {
  const faqJsonLd = generateFAQSchema(HOMEPAGE_FAQS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HeroSection />
      <ValueStrip />
      <CoreFeatures />
      <AudienceSolutions />
      <ProductCards />
      <HowItWorks />
      <OfflineFirst />
      <FAQSection />
      <PricingPreview />
      <FinalCTASection />
    </>
  );
}
