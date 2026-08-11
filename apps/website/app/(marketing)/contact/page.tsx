import React from "react";
import { Phone, Mail, Clock } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata = generateSEOMetadata({
  title: "Contact Dineiz — Book a Demo or Get Support",
  description: "Contact the Dineiz team for a product demo, sales inquiry, or support. Reach us via WhatsApp, phone, or email — we respond within the hour.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <section className="bg-white border-b border-gray-100 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 mb-4">Contact</span>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-4">
                Let&apos;s talk about your restaurant
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-8">
                Whether you want a demo, have a question about pricing, or need help setting up — our team is ready. We typically respond within an hour on WhatsApp.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Phone, label: "WhatsApp / Phone", value: "+92 314 1986044" },
                  { icon: Mail, label: "Email", value: "hello@dineiz.com" },
                  { icon: Clock, label: "Support Hours", value: "9 AM – 10 PM, 7 days a week" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-brand-500" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.label}</div>
                        <div className="text-sm text-gray-800 font-medium mt-0.5">{item.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-8">
                <a
                  href="https://wa.me/923141986044?text=Hi%2C%20I%27d%20like%20a%20Dineiz%20demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  WhatsApp Us Now
                </a>
              </div>
            </div>

            {/* Right: simple form */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-7 shadow-card">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Send us a message</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
