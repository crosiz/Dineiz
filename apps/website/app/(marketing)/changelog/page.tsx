import React from "react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({
  title: "Changelog — Dineiz Product Updates",
  description: "See the latest updates, improvements, and new features released in Dineiz.",
  path: "/changelog",
});

const entries = [
  {
    version: "v2.4.0",
    date: "January 2025",
    tag: "Major Release",
    tagColor: "bg-brand-100 text-brand-700",
    changes: [
      "New table map with drag-and-drop floor plan editor",
    ],
  },
  {
    version: "v2.3.5",
    date: "December 2024",
    tag: "Improvement",
    tagColor: "bg-blue-100 text-blue-700",
    changes: [
      "Offline sync now works for up to 72 hours without internet",
      "Kitchen Display timer now shows colour alerts at 10/15/20 min",
      "Performance: POS loads 40% faster on low-end Android devices",
    ],
  },
  {
    version: "v2.3.0",
    date: "November 2024",
    tag: "New Feature",
    tagColor: "bg-green-100 text-green-700",
    changes: [
      "Inventory module: automatic ingredient deduction per dish",
      "Low-stock WhatsApp & SMS alerts for restaurant owners",
      "Supplier purchase order generation from Console",
    ],
  },
  {
    version: "v2.2.0",
    date: "October 2024",
    tag: "New Feature",
    tagColor: "bg-green-100 text-green-700",
    changes: [
      "Multi-branch dashboard now supports up to 10 locations",
      "Branch-level and company-level reporting in Console",
      "Staff performance ranking across branches",
    ],
  },
];

export const dynamic = 'force-static';

export default function ChangelogPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Changelog</span>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Product Updates</h1>
          <p className="text-base text-gray-500">We ship every week. Here&apos;s what&apos;s new in Dineiz.</p>
        </div>
      </section>
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {entries.map((entry) => (
            <div key={entry.version} className="bg-white border border-gray-200 rounded-xl shadow-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${entry.tagColor}`}>{entry.tag}</span>
                <span className="text-sm font-bold text-gray-900">{entry.version}</span>
                <span className="text-xs text-gray-400 ml-auto">{entry.date}</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {entry.changes.map((c) => (
                  <li key={c} className="flex items-start gap-3 px-5 py-3 text-sm text-gray-700">
                    <span className="text-brand-500 mt-0.5">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

