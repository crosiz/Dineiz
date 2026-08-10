import React from "react";
import { Inter } from 'next/font/google'
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import "./globals.css";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { generateSEO } from "@/lib/seo";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
})

export const metadata = generateSEO({
  title: "Restaurant POS System Pakistan & WhatsApp Ordering",
  description:
    "The #1 restaurant POS, billing software, and WhatsApp AI ordering system in Pakistan. Billing for cafes, food carts, and multi-branch restaurant groups. FBR compliant.",
  canonical: "https://dineiz.com",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dineiz',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android, iOS',
    description: 'Restaurant POS and management software for Pakistan',
    url: 'https://dineiz.com',
    creator: {
      '@type': 'Organization',
      name: 'Crosiz Technologies',
      url: 'https://crosiz.com',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'PKR',
      description: 'Free plan available',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '200',
    },
  }

  return (
    <html
      lang="en"
      className={`${inter.variable}`}
    >
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* JSON-LD Schemas */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />

        {/* GTM Head Script */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID || "GTM-DINEIZ"}');
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>

        <Navbar />

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
