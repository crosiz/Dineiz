import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import { getRelatedPosts } from '@/lib/mdx';

interface RelatedPostsProps {
  currentSlug: string;
  category: string;
}

export async function RelatedPosts({ currentSlug, category }: RelatedPostsProps) {
  const relatedPosts = await getRelatedPosts(currentSlug, category, 3);

  if (relatedPosts.length === 0) return null;

  return (
    <div className="mt-16 pt-16 border-t border-gray-100">
      <h3 className="text-2xl font-bold text-gray-900 mb-8">Related Articles</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedPosts.map((post) => (
          <article
            key={post.slug}
            className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
          >
            <div className="relative w-full h-40 bg-gray-50 overflow-hidden">
              <Link href={`/blog/${post.slug}`}>
                <Image
                  src={post.image || '/images/blog-placeholder.jpg'}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </Link>
            </div>
            <div className="p-5 flex flex-col flex-grow">
              <span className="text-xs text-gray-400 flex items-center gap-1 mb-2 font-medium">
                <Clock size={12} /> {post.readTime}
              </span>
              <h4 className="text-base font-bold text-gray-900 group-hover:text-brand-600 transition-colors leading-snug line-clamp-2">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h4>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
