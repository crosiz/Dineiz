import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin-internal/'] }
    ],
    sitemap: 'https://dineiz.com/sitemap.xml',
    host: 'https://dineiz.com',
  }
}
