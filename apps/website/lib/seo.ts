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
  const fullTitle = `${title} | Dineiz`
  const finalUrl = canonical ?? (path ? `${BASE_URL}${path}` : BASE_URL)
  // Falls back to a per-page dynamic OG image (title baked in) rather than
  // one generic image shared across every page/post on social shares.
  const finalOgImage = ogImage ?? `${BASE_URL}/api/og?title=${encodeURIComponent(title)}`

  return {
    title: fullTitle,
    description,
    keywords: [
      'restaurant POS Pakistan',
      'billing software restaurant',
      'dhaba billing app',
      ...keywords,
    ].join(', '),
    authors: authors ? authors.map(name => ({ name })) : [{ name: 'Dineiz', url: BASE_URL }],
    creator: 'Dineiz by Crosiz Technologies',
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: finalUrl,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title: fullTitle,
      description,
      url: finalUrl,
      siteName: 'Dineiz',
      images: [{ url: finalOgImage, width: 1200, height: 630, alt: title }],
      locale: 'en_PK',
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
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }
}

export function generateSoftwareApplicationSchema(
  name = 'Dineiz',
  description = 'Restaurant POS and management software for Pakistan',
  price = '0'
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, Android, iOS',
    description,
    url: 'https://dineiz.com',
    creator: {
      '@type': 'Organization',
      name: 'Crosiz Technologies',
      url: 'https://crosiz.com',
    },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'PKR',
      description: 'Free plan available',
    },
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
      name: authorName
    },
    publisher: {
      '@type': 'Organization',
      name: 'Dineiz',
      logo: {
        '@type': 'ImageObject',
        url: 'https://dineiz.com/logo.svg'
      }
    }
  }
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dineiz',
    legalName: 'Crosiz Technologies',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    description: 'Restaurant POS and management software built in Pakistan.',
    email: 'hello@dineiz.com',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+92-314-1986044',
      contactType: 'customer service',
      areaServed: 'PK',
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
    url: BASE_URL,
    publisher: {
      '@type': 'Organization',
      name: 'Dineiz',
    },
  }
}
