import { Metadata } from 'next'

const BASE_URL = 'https://dineiz.com'
const DEFAULT_OG = `${BASE_URL}/api/og`

interface SEOProps {
  title: string
  description: string
  keywords?: string[]
  ogImage?: string
  canonical?: string
  noIndex?: boolean
}

export function generateSEO({
  title,
  description,
  keywords = [],
  ogImage = DEFAULT_OG,
  canonical,
  noIndex = false,
}: SEOProps): Metadata {
  const fullTitle = `${title} | Dineiz`

  return {
    title: fullTitle,
    description,
    keywords: [
      'restaurant POS Pakistan',
      'billing software restaurant',
      'dhaba billing app',
      ...keywords,
    ].join(', '),
    authors: [{ name: 'Dineiz', url: BASE_URL }],
    creator: 'Dineiz by Crosiz Technologies',
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: canonical ?? BASE_URL,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical ?? BASE_URL,
      siteName: 'Dineiz',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      locale: 'en_PK',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
      creator: '@dineizpk',
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }
}
