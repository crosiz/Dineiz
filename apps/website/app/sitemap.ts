import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = 'https://dineiz.com'
  const now = new Date()

  const staticPages = [
    { url: BASE, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${BASE}/pricing`, priority: 0.9, changeFrequency: 'weekly' },
    { url: `${BASE}/features`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/product/pos`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/product/go`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/product/console`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/product/whatsapp`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/dhaba`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/restaurant`, priority: 0.8, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/cafe`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/industries/food-cart`, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${BASE}/about`, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/contact`, priority: 0.6, changeFrequency: 'monthly' },
    { url: `${BASE}/blog`, priority: 0.7, changeFrequency: 'daily' },
  ].map(page => ({ ...page, lastModified: now, changeFrequency: page.changeFrequency as "weekly" | "monthly" | "daily" }))

  return staticPages
}
