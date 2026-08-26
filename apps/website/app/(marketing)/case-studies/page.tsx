import React from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { getAllCaseStudies } from "@/lib/mdx";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Dineiz Customer Success Stories — Pakistani Restaurants",
  description:
    "Read how Pakistani restaurants increased revenue, stopped staff theft, and streamlined kitchen operations with Dineiz.",
  path: "/case-studies",
});

export const dynamic = 'force-static';

export default async function CaseStudiesPage() {
  const caseStudies = await getAllCaseStudies();

  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">
            Customer Success Stories
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            How Pakistani restaurants <span className="text-brand-500">win with Dineiz</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500">
            Real stories from real Pakistani restaurants, as our customer base grows.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {caseStudies.length === 0 ? (
            <p className="text-center text-gray-500 text-base">
              We&apos;re just getting started — check back soon for real customer stories.
            </p>
          ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {caseStudies.map((cs) => (
              <div
                key={cs.slug}
                className="bg-white border border-gray-200 rounded-2xl p-7 shadow-card flex flex-col justify-between hover:shadow-card-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                      {cs.restaurantType}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={13} className="text-brand-500" /> {cs.location}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">
                    {cs.restaurantName}
                  </h2>

                  <p className="text-sm text-gray-600 leading-relaxed mb-6 italic">
                    &ldquo;{cs.quote}&rdquo;
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 mb-6 text-center">
                    {cs.results.map((res, i) => (
                      <div key={i}>
                        <div className="text-lg font-bold text-brand-600">{res.metric}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 font-medium">{res.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/case-studies/${cs.slug}`}
                  className="font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 text-sm transition-colors"
                >
                  <span>Read Full Case Study</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
          )}
        </div>
      </section>
    </>
  );
}

