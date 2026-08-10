import React from "react";
import Link from "next/link";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({ title: "Careers — Join the Dineiz Team", description: "Join Dineiz and help build Pakistan's best restaurant software.", path: "/careers" });

const roles = [
  { title: "Senior React Native Developer", team: "Engineering", type: "Full-time · Remote" },
  { title: "Customer Success Manager (Lahore)", team: "Customer Success", type: "Full-time · On-site" },
  { title: "Sales Development Representative", team: "Sales", type: "Full-time · Lahore / Karachi" },
  { title: "UX Designer", team: "Product", type: "Full-time · Remote" },
];

export default function CareersPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Careers</span>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">Join the team building Pakistan&apos;s restaurant future</h1>
          <p className="text-base text-gray-500 leading-relaxed">
            We are a small, high-ownership team at Crosiz Technologies working on Dineiz. We move fast, ship weekly, and care deeply about the restaurant owners we serve.
          </p>
        </div>
      </section>
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Open Roles</h2>
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.title} className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-card flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{role.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{role.team} · {role.type}</div>
                </div>
                <Link href="/contact" className="shrink-0 px-4 py-2 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:border-brand-400 hover:text-brand-600 transition-colors">
                  Apply
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-brand-50 border border-brand-100 rounded-xl p-5">
            <div className="text-sm font-semibold text-brand-800 mb-1">Don&apos;t see your role?</div>
            <p className="text-sm text-brand-700">We&apos;re always looking for great people. Send your CV to <a href="mailto:careers@dineiz.com" className="underline">careers@dineiz.com</a></p>
          </div>
        </div>
      </section>
    </>
  );
}
