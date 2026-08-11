'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, User, ArrowRight, Search } from 'lucide-react';
import type { BlogPost } from '@/lib/mdx';

interface BlogClientProps {
  posts: BlogPost[];
  categories: string[];
}

export function BlogClient({ posts, categories }: BlogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            post.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [posts, searchQuery, selectedCategory]);

  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">
            Restaurant Guides & Knowledge
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            The Dineiz <span className="text-brand-500">Blog</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-10">
            Practical advice on restaurant POS software, FBR tax rules, WhatsApp ordering, and business growth in Pakistan.
          </p>

          <div className="relative max-w-xl mx-auto mb-8">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-4 border border-gray-300 rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm text-sm sm:text-base"
              placeholder="Search articles, guides, and tips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'All'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16 lg:py-24 min-h-[50vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
              <p className="text-gray-500">We couldn't find any articles matching your search criteria.</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-4 text-brand-600 font-medium hover:text-brand-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <article
                  key={post.slug}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-card flex flex-col justify-between hover:shadow-card-md transition-shadow group h-full"
                >
                  <div className="relative w-full h-48 bg-gray-100 border-b border-gray-100 overflow-hidden">
                    <Link href={`/blog/${post.slug}`}>
                      <Image 
                        src={post.image || '/images/blog-placeholder.jpg'} 
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                        {post.category}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                        <Clock size={13} /> {post.readTime}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-brand-600 transition-colors leading-snug">
                      <Link href={`/blog/${post.slug}`} className="block">{post.title}</Link>
                    </h2>

                    <p className="text-sm text-gray-500 leading-relaxed mb-6 line-clamp-3">
                      {post.description}
                    </p>
                    
                    <div className="mt-auto"></div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-brand-500" />
                      <span className="font-medium text-gray-700">{post.author}</span>
                    </div>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                    >
                      Read Post <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
