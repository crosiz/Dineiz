import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const commonDisallows = ['/api/', '/admin-internal/'];

  const aiBots = [
    'GPTBot',
    'ChatGPT-User',
    'ClaudeBot',
    'anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'cohere-ai',
    'Bytespider',
    'CCBot',
    'Diffbot',
    'FacebookBot',
    'Omgilibot',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: commonDisallows,
      },
      ...aiBots.map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: commonDisallows,
      })),
    ],
    sitemap: 'https://dineiz.com/sitemap.xml',
    host: 'https://dineiz.com',
  }
}
