import { MetadataRoute } from 'next';
import { getAllBlogPosts, getAllCaseStudies } from '@/lib/mdx';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dineiz.com';

  // Static routes
  const staticRoutes = [
    '',
    '/pricing',
    '/features',
    '/product/pos',
    '/product/console',
    '/product/go',
    '/product/whatsapp',
    '/industries/dhaba',
    '/industries/restaurant',
    '/industries/cafe',
    '/industries/food-cart',
    '/about',
    '/contact',
    '/blog',
    '/case-studies',
    '/changelog',
    '/careers',
    '/partners',
    '/privacy-policy',
    '/terms-of-service',
    '/refund-policy',
    '/cookie-policy',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Dynamic Blog Posts
  const posts = await getAllBlogPosts();
  const blogRoutes = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.date || new Date().toISOString().split('T')[0],
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Dynamic Case Studies
  const caseStudies = await getAllCaseStudies();
  const caseStudyRoutes = caseStudies.map((cs) => ({
    url: `${baseUrl}/case-studies/${cs.slug}`,
    lastModified: new Date().toISOString().split('T')[0],
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...blogRoutes, ...caseStudyRoutes];
}
