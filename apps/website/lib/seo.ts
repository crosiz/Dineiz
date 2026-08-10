import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dineiz.com";
export const SITE_NAME = "Dineiz";
export const DEFAULT_KEYWORDS = [
  "restaurant POS Pakistan",
  "POS system for restaurants Pakistan",
  "food cart billing software",
  "restaurant billing app Pakistan",
  "WhatsApp ordering system restaurant",
  "restaurant management software Pakistan",
  "tablet POS restaurant",
  "Dineiz POS",
  "FBR POS integration Pakistan",
  "Pakistani restaurant software"
];

interface GenerateMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string;
  type?: "website" | "article";
  publishedTime?: string;
  authors?: string[];
}

export function generateSEOMetadata({
  title,
  description,
  path,
  keywords = [],
  ogImage,
  type = "website",
  publishedTime,
  authors,
}: GenerateMetadataOptions): Metadata {
  const pageTitle = title.includes("Dineiz")
    ? title
    : `${title} | Dineiz — Restaurant POS Pakistan`;

  const canonicalUrl = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const ogImageUrl = ogImage || `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&desc=${encodeURIComponent(description.slice(0, 100))}`;
  const combinedKeywords = Array.from(new Set([...keywords, ...DEFAULT_KEYWORDS]));

  return {
    title: pageTitle,
    description,
    keywords: combinedKeywords.join(", "),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      locale: "en_PK",
      type: type === "article" ? "article" : "website",
      ...(publishedTime && { publishedTime }),
      ...(authors && { authors }),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [ogImageUrl],
      creator: "@DineizPK",
      site: "@DineizPK",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

// JSON-LD Generators
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Dineiz",
    legalName: "Dineiz by Crosiz Technologies",
    url: SITE_URL,
    logo: `${SITE_URL}/images/dineiz-logo.png`,
    description: "Restaurant POS, billing, and management SaaS platform built for Pakistan and MENA region.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Lahore",
      addressRegion: "Punjab",
      addressCountry: "PK",
    },
    sameAs: [
      "https://facebook.com/dineizpk",
      "https://instagram.com/dineiz.com",
      "https://linkedin.com/company/dineiz",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+923000000000",
      contactType: "customer service",
      areaServed: ["PK", "AE", "SA"],
      availableLanguage: ["English", "Urdu"],
    },
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Dineiz",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateSoftwareApplicationSchema(appName: string, description: string, price: string = "0") {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: appName,
    operatingSystem: "Android, iOS, Windows, Web",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: price,
      priceCurrency: "PKR",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "210",
    },
    description,
  };
}

export function generateProductPricingSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Dineiz Restaurant POS Subscription",
    description: "Complete restaurant billing, kitchen display, inventory, and WhatsApp AI ordering software for Pakistan.",
    brand: {
      "@type": "Brand",
      name: "Dineiz",
    },
    offers: [
      {
        "@type": "Offer",
        name: "Dineiz Go Free",
        price: "0",
        priceCurrency: "PKR",
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Dineiz Go Pro",
        price: "999",
        priceCurrency: "PKR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "999",
          priceCurrency: "PKR",
          unitCode: "MON",
        },
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Dineiz Starter",
        price: "2999",
        priceCurrency: "PKR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "2999",
          priceCurrency: "PKR",
          unitCode: "MON",
        },
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "Dineiz Pro",
        price: "5999",
        priceCurrency: "PKR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "5999",
          priceCurrency: "PKR",
          unitCode: "MON",
        },
        availability: "https://schema.org/InStock",
      },
    ],
  };
}

export function generateArticleSchema(title: string, description: string, url: string, date: string, author: string = "Dineiz Team") {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: "Dineiz",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/dineiz-logo.png`,
      },
    },
    datePublished: date,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

export function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Dineiz Pakistan",
    image: `${SITE_URL}/images/dineiz-logo.png`,
    telephone: "+923001234567",
    email: "hello@dineiz.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Gulberg III",
      addressLocality: "Lahore",
      addressRegion: "Punjab",
      postalCode: "54000",
      addressCountry: "PK",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "09:00",
      closes: "22:00",
    },
    priceRange: "PKR 0 - PKR 5,999",
  };
}
