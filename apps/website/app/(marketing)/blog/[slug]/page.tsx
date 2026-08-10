import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Calendar, ArrowLeft, MessageCircle } from "lucide-react";
import { getBlogPostBySlug, getAllBlogPosts } from "@/lib/mdx";
import { generateSEOMetadata, generateArticleSchema } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};

  return generateSEOMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.date,
    authors: [post.author],
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const articleSchema = generateArticleSchema(
    post.title,
    post.description,
    `https://dineiz.com/blog/${post.slug}`,
    post.date,
    post.author
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-600 mb-8 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Blog
          </Link>

          {/* Header */}
          <div className="space-y-4 mb-10 pb-8 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                {post.category}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={13} /> {post.readTime}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar size={13} /> {post.date}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              {post.title}
            </h1>

            <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
              {post.description}
            </p>

            <div className="flex items-center gap-3 pt-4">
              <div className="w-9 h-9 rounded-full bg-brand-500 font-bold text-white flex items-center justify-center text-xs">
                {post.author.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{post.author}</div>
                <div className="text-xs text-gray-400">{post.authorRole}</div>
              </div>
            </div>
          </div>

          {/* Article Body */}
          <div className="prose prose-sm sm:prose-base prose-gray max-w-none text-gray-700 leading-relaxed space-y-6">
            <div className="whitespace-pre-line">{post.content}</div>
          </div>

          {/* Share & Author Card */}
          <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              Published on <strong className="text-gray-900">{post.date}</strong> by {post.author}
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(post.title)}%20https://dineiz.com/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors"
              >
                <MessageCircle size={14} /> Share on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
