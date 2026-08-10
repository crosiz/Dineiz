import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowLeft } from "lucide-react";
import { getCaseStudyBySlug, getAllCaseStudies } from "@/lib/mdx";
import { generateSEOMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const caseStudies = await getAllCaseStudies();
  return caseStudies.map((cs) => ({ slug: cs.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const cs = await getCaseStudyBySlug(slug);
  if (!cs) return {};

  return generateSEOMetadata({
    title: `${cs.restaurantName} Case Study — Dineiz POS`,
    description: `How ${cs.restaurantName} in ${cs.location} achieved ${cs.results[0]?.metric || 'growth'} with Dineiz.`,
    path: `/case-studies/${cs.slug}`,
  });
}

export default async function CaseStudyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const cs = await getCaseStudyBySlug(slug);
  if (!cs) notFound();

  return (
    <article className="bg-white py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/case-studies"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-600 mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Case Studies
        </Link>

        <div className="space-y-4 mb-10 pb-8 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
              {cs.restaurantType}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin size={13} className="text-brand-500" /> {cs.location}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            {cs.restaurantName}
          </h1>

          {/* Results metrics hero banner */}
          <div className="grid grid-cols-3 gap-4 p-6 rounded-2xl bg-brand-50 border border-brand-100 text-center my-6">
            {cs.results.map((res, i) => (
              <div key={i}>
                <div className="text-2xl sm:text-4xl font-extrabold text-brand-600">{res.metric}</div>
                <div className="text-xs text-brand-800 mt-1 font-medium">{res.label}</div>
              </div>
            ))}
          </div>

          <blockquote className="p-6 rounded-xl bg-gray-50 border-l-4 border-brand-500 italic text-gray-700 text-base leading-relaxed">
            &ldquo;{cs.quote}&rdquo;
            <footer className="text-xs font-bold text-gray-900 mt-2 not-italic">
              — {cs.author}
            </footer>
          </blockquote>
        </div>

        {/* Content */}
        <div className="prose prose-sm sm:prose-base prose-gray max-w-none text-gray-600 leading-relaxed space-y-6">
          <div className="whitespace-pre-line">{cs.content}</div>
        </div>
      </div>
    </article>
  );
}
