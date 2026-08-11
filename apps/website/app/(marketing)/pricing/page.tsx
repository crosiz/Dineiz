import React from "react";
import { generateSEOMetadata } from "@/lib/seo";
import { PLANS } from "@/lib/plans";
import { PricingClient } from "@/components/pricing/PricingClient";

export const metadata = generateSEOMetadata({
  title: 'Pricing — Restaurant POS Plans Starting at PKR 0',
  description: 'Dineiz pricing plans for every restaurant size. Free forever plan for dhabas. Pro plans from PKR 999/month. 14-day free trial on all paid plans. FBR compliant.',
  keywords: ['restaurant POS price Pakistan', 'billing software price', 'POS system cost Pakistan'],
  canonical: 'https://dineiz.com/pricing',
});

// JSON-LD for pricing page
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: PLANS.map((plan, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: plan.name,
      description: plan.tagline,
      offers: {
        '@type': 'Offer',
        price: plan.monthlyPrice || 0,
        priceCurrency: 'PKR',
        availability: 'https://schema.org/InStock',
      }
    }
  }))
};

export const dynamic = 'force-static';

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingClient />
    </>
  );
}

