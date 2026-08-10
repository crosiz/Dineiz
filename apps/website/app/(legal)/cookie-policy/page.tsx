import React from "react";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata = generateSEOMetadata({ title: "Cookie Policy — Dineiz", description: "Learn how Dineiz uses cookies on its website.", path: "/cookie-policy" });

export default function CookiePolicyPage() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 pb-8 border-b border-gray-100">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-3">Legal</span>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Cookie Policy</h1>
          <p className="text-sm text-gray-400">Last updated: January 2025</p>
        </div>
        <div className="space-y-6">
          {[
            { title: "What Are Cookies?", body: "Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your browsing experience." },
            { title: "Cookies We Use", body: "We use essential cookies (required for the site to work), analytics cookies (to understand how visitors use the site via Vercel Analytics), and preference cookies (to remember your settings like language and dismissed announcements)." },
            { title: "Essential Cookies", body: "These cookies are necessary for the website to function. They include session cookies for authentication and security. You cannot opt out of these cookies." },
            { title: "Analytics Cookies", body: "We use Vercel Analytics, which is privacy-first and does not track individual users. Aggregated data helps us understand traffic patterns and improve the site." },
            { title: "Managing Cookies", body: "You can control cookies through your browser settings. Disabling cookies may affect the functionality of certain features, such as the dismissed announcement bar." },
            { title: "Contact", body: "For questions about our cookie practices, contact us at privacy@dineiz.com." },
          ].map((s) => (
            <div key={s.title}>
              <h2 className="text-base font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
