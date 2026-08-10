import React from "react";
import Link from "next/link";
import { Clock, User, ArrowRight } from "lucide-react";
import { getAllBlogPosts } from "@/lib/mdx";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz Blog — Restaurant Management Tips & Guides for Pakistan",
  description:
    "Guides, FBR tax compliance articles, and revenue growth strategies for restaurant owners in Pakistan.",
  path: "/blog",
});

export default async function BlogListingPage() {
  const posts = await getAllBlogPosts();

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
          <p className="text-base sm:text-lg text-gray-500">
            Practical advice on restaurant POS software, FBR tax rules, WhatsApp ordering, and business growth in Pakistan.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-card flex flex-col justify-between hover:shadow-card-md transition-shadow group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={13} /> {post.readTime}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-brand-600 transition-colors leading-snug">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>

                  <p className="text-xs sm:text-sm text-gray-500 leading-relaxed mb-6 line-clamp-3">
                    {post.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-brand-500" />
                    <span>{post.author}</span>
                  </div>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                  >
                    Read Post <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
