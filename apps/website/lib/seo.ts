import { Metadata } from 'next'

const BASE_URL = 'https://dineiz.com'

interface SEOProps {
  title: string
  description: string
  keywords?: string[]
  ogImage?: string
  canonical?: string
  path?: string
  noIndex?: boolean
  type?: 'website' | 'article'
  publishedTime?: string
  authors?: string[]
}

export function generateSEOMetadata({
  title,
  description,
  keywords = [],
  ogImage,
  canonical,
  path,
  noIndex = false,
  type = 'website',
  publishedTime,
  authors,
}: SEOProps): Metadata {
  const fullTitle = title.toLowerCase().includes('dineiz') ? title : `${title} | Dineiz`
  const finalUrl = canonical ?? (path ? `${BASE_URL}${path}` : BASE_URL)
  const finalOgImage = ogImage ?? `${BASE_URL}/api/og?title=${encodeURIComponent(title)}`

  return {
    title: fullTitle,
    description,
    keywords: [
      'restaurant POS Pakistan',
      'billing software restaurant',
      'dhaba billing app',
      'point of sale system',
      'restaurant management system',
      'cloud POS',
      'offline restaurant POS',
      'cafe billing software',
      'food cart POS',
      'kitchen display system KDS',
      'WhatsApp restaurant ordering',
      'restaurant inventory software',
      'multi-branch POS',
      'FBR POS integration Pakistan',
      'thermal receipt printer POS',
      ...keywords,
    ].join(', '),
    authors: authors ? authors.map(name => ({ name })) : [{ name: 'Dineiz', url: BASE_URL }],
    creator: 'Dineiz by Crosiz Technologies',
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: finalUrl,
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/icon.png', sizes: '32x32', type: 'image/png' },
        { url: '/dineiz-app-icon.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    openGraph: {
      title: fullTitle,
      description,
      url: finalUrl,
      siteName: 'Dineiz',
      images: [{ url: finalOgImage, width: 1200, height: 630, alt: title, type: 'image/png' }],
      locale: 'en_PK',
      alternateLocale: ['en_US', 'ur_PK'],
      type: type,
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [finalOgImage],
      creator: '@dineizpk',
    },
    other: {
      'geo.region': 'PK',
      'geo.placename': 'Pakistan',
      'rating': 'General',
      'application-name': 'Dineiz POS',
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }
}

export function generateSoftwareApplicationSchema(
  name = 'Dineiz',
  description = 'Offline-first restaurant POS and management platform for restaurants, cafes, food carts, and multi-branch chains in Pakistan and MENA.',
  price = '0'
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Restaurant Point of Sale (POS) & Management Software',
    operatingSystem: 'Android, iOS, Windows, macOS, Web (PWA)',
    softwareVersion: '2.4.0',
    description,
    url: 'https://dineiz.com',
    softwareRequirements: 'Modern web browser, Android 8+, iOS 14+, Windows 10/11; optional 58mm/80mm ESC/POS thermal printer',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '185',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      '100% Offline-First Local Outbox Synchronization',
      'Touch-Optimized Tablet & Mobile POS Billing',
      'Conversational WhatsApp AI Food Ordering in Roman Urdu and English',
      'Real-Time Kitchen Display System (KDS) with Station Routing',
      'Visual Interactive Table Floor Plan Management',
      'Recipe-Level Raw Inventory & Automated Stock Depletion',
      'Blind Cash Drawer Reconciliation & Shift Z-Reports',
      'FBR POS Invoicing & Provincial GST Tax Compliance',
      'Multi-Branch Centralized Menu & Reporting Console',
      'Thermal Receipt Printing via Bluetooth, USB, and LAN (ESC/POS)',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Crosiz Technologies',
      url: 'https://crosiz.com',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Go Free',
        price: '0',
        priceCurrency: 'PKR',
        description: 'Free forever mobile POS plan for small food carts and dhabas',
        availability: 'https://schema.org/InStock',
        url: 'https://dineiz.com/pricing',
      },
      {
        '@type': 'Offer',
        name: 'Go Pro',
        price: '999',
        priceCurrency: 'PKR',
        description: 'Mobile POS with unlimited orders and Bluetooth printing',
        availability: 'https://schema.org/InStock',
        url: 'https://dineiz.com/pricing',
      },
      {
        '@type': 'Offer',
        name: 'Starter',
        price: price === '0' ? '2999' : price,
        priceCurrency: 'PKR',
        description: 'Tablet POS with table management and KDS for dine-in restaurants',
        availability: 'https://schema.org/InStock',
        url: 'https://dineiz.com/pricing',
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '5999',
        priceCurrency: 'PKR',
        description: 'Complete restaurant OS with WhatsApp AI and multi-branch control',
        availability: 'https://schema.org/InStock',
        url: 'https://dineiz.com/pricing',
      },
    ],
  }
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  }
}

export function generateArticleSchema(
  title: string,
  description: string,
  url: string,
  datePublished: string,
  authorName: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    url: url,
    datePublished: new Date(datePublished).toISOString(),
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Dineiz',
      logo: {
        '@type': 'ImageObject',
        url: 'https://dineiz.com/logo.png',
      },
    },
  }
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dineiz',
    legalName: 'Crosiz Technologies',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Offline-first restaurant POS and management software built in Pakistan by Crosiz Technologies.',
    email: 'hello@dineiz.com',
    currenciesAccepted: ['PKR', 'USD', 'AED', 'SAR'],
    knowsAbout: [
      'Restaurant Point of Sale (POS)',
      'Offline-First Software Architecture',
      'Kitchen Display Systems (KDS)',
      'WhatsApp AI Conversational Ordering',
      'Food & Beverage Inventory Control',
      'GST & FBR Invoicing Compliance',
      'Thermal Receipt Printing (ESC/POS)',
      'Multi-Branch Restaurant Analytics',
      'Cafe Billing Systems',
      'Dhaba & Food Cart Mobile POS',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+92-314-1986044',
      contactType: 'customer service',
      areaServed: ['PK', 'AE', 'SA', 'Worldwide'],
      availableLanguage: ['en', 'ur'],
    },
    sameAs: [
      'https://instagram.com/dineiz.com',
      'https://linkedin.com/company/dineiz',
      'https://youtube.com/@dineiz',
    ],
  }
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Dineiz',
    alternateName: ['Dineiz POS', 'Dineiz Restaurant Software', 'Dineiz.com', 'Dineiz Pakistan'],
    url: BASE_URL,
    publisher: {
      '@type': 'Organization',
      name: 'Dineiz',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/blog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}
