import React from "react";
import { HeroSection } from "@/components/sections/HeroSection";
import { LogoBar } from "@/components/sections/LogoBar";
import { CoreFeatures } from "@/components/sections/CoreFeatures";
import { ProductCards } from "@/components/sections/ProductCards";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { PricingPreview } from "@/components/sections/PricingPreview";
import { CompareCompetitors } from "@/components/sections/CompareCompetitors";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz — Best Restaurant POS System in Pakistan & MENA",
  description:
    "The best restaurant POS, billing software, and WhatsApp ordering system in Pakistan and MENA. Clean, minimal, and modest point of sale for food businesses.",
  path: "/",
});

export default function Homepage() {
  return (
    <>
      <HeroSection />
      <LogoBar />
      <CoreFeatures />
      <ProductCards />
      <HowItWorks />
      <Testimonials />
      <PricingPreview />
      <CompareCompetitors />
      <FinalCTASection />
    </>
  );
}
