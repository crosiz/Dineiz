import { MetadataRoute } from 'next'
import { getAllBlogPosts, getAllCaseStudies } from '@/lib/mdx'

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
    { url: `${BASE}/case-studies`, priority: 0.5, changeFrequency: 'monthly' },
    { url: `${BASE}/changelog`, priority: 0.4, changeFrequency: 'weekly' },
    { url: `${BASE}/careers`, priority: 0.4, changeFrequency: 'weekly' },
    { url: `${BASE}/partners`, priority: 0.4, changeFrequency: 'monthly' },
    { url: `${BASE}/privacy-policy`, priority: 0.2, changeFrequency: 'monthly' },
    { url: `${BASE}/terms-of-service`, priority: 0.2, changeFrequency: 'monthly' },
    { url: `${BASE}/refund-policy`, priority: 0.2, changeFrequency: 'monthly' },
    { url: `${BASE}/cookie-policy`, priority: 0.2, changeFrequency: 'monthly' },
  ].map(page => ({ ...page, lastModified: now, changeFrequency: page.changeFrequency as "weekly" | "monthly" | "daily" }))

  const blogPosts = await getAllBlogPosts()
  const caseStudies = await getAllCaseStudies()

  const dynamicBlogPages = blogPosts.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.6,
    changeFrequency: 'monthly' as const
  }))

  const dynamicCaseStudyPages = caseStudies.map((study) => ({
    url: `${BASE}/case-studies/${study.slug}`,
    lastModified: now,
    priority: 0.6,
    changeFrequency: 'monthly' as const
  }))

  return [...staticPages, ...dynamicBlogPages, ...dynamicCaseStudyPages]
}
