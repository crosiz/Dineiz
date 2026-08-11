import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Clock, Calendar, ArrowLeft } from "lucide-react";
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getBlogPostBySlug, getAllBlogPosts } from "@/lib/mdx";
import { generateSEOMetadata, generateArticleSchema } from "@/lib/seo";
import { InternalLinks } from "@/components/seo/InternalLinks";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ShareButton } from "@/components/blog/ShareButton";
import { NewsletterForm } from "@/components/blog/NewsletterForm";
import { RelatedPosts } from "@/components/blog/RelatedPosts";

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

      <article className="bg-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-10 lg:mb-16">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-600 mb-8 transition-colors"
            >
              <ArrowLeft size={16} /> Back to all articles
            </Link>

            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider">
                  {post.category}
                </span>
                <span className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                  <Clock size={16} /> {post.readTime}
                </span>
                <span className="text-sm text-gray-500 flex items-center gap-1.5 font-medium">
                  <Calendar size={16} /> {post.date}
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
                {post.title}
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-3xl">
                {post.description}
              </p>
            </div>
          </div>

          <div className="relative w-full h-[400px] sm:h-[500px] rounded-3xl overflow-hidden mb-16 bg-gray-100">
            <Image
              src={post.image || '/images/blog-placeholder.jpg'}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <TableOfContents content={post.content} />
            </aside>

            <div className="flex-1 min-w-0">
              <div className="prose prose-lg prose-brand max-w-none prose-headings:font-bold prose-a:font-semibold prose-img:rounded-xl">
                <MDXRemote source={post.content} />
              </div>

              {/* Author Card & Share */}
              <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-brand-500 font-bold text-white flex items-center justify-center text-xl shadow-sm">
                    {post.author.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-0.5">Written by</div>
                    <div className="font-bold text-gray-900 text-lg leading-none">{post.author}</div>
                    <div className="text-sm text-gray-500 mt-1">{post.authorRole}</div>
                  </div>
                </div>

                <ShareButton url={`https://dineiz.com/blog/${post.slug}`} title={post.title} />
              </div>

              <RelatedPosts currentSlug={post.slug} category={post.category} />
              
              <div className="mt-16">
                <NewsletterForm />
              </div>
              
              <div className="mt-16 pt-8 border-t border-gray-100">
                <InternalLinks currentPath={`/blog/${post.slug}`} />
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
