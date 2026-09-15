"use client";

import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, HelpCircle } from "lucide-react";

import { HOMEPAGE_FAQS } from "@/lib/faqs";

export function FAQSection() {
  return (
    <section className="bg-[#fafafa] py-20 lg:py-28 border-t border-gray-100" id="faq">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-brand-600 text-xs font-semibold mb-4">
            <HelpCircle size={14} className="text-brand-500" />
            Common Questions
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-gray-500 max-w-xl mx-auto">
            Everything you need to know about Dineiz POS, offline billing, hardware compatibility, and WhatsApp AI ordering.
          </p>
        </div>

        <Accordion.Root type="single" collapsible className="flex flex-col gap-3.5">
          {HOMEPAGE_FAQS.map((item, index) => (
            <Accordion.Item
              key={index}
              value={`home-faq-${index}`}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs hover:border-gray-300 transition-colors"
            >
              <Accordion.Header className="flex">
                <Accordion.Trigger className="flex-1 flex items-center justify-between p-5 text-left text-[15px] sm:text-[16px] font-semibold text-gray-900 hover:text-brand-500 transition-colors group">
                  <span className="pr-4">{item.question}</span>
                  <ChevronDown
                    size={18}
                    className="text-gray-400 group-hover:text-brand-500 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden text-[14px] text-gray-600 leading-relaxed">
                <div className="px-5 pb-5 pt-0 border-t border-gray-50 mt-1 pt-3">
                  {item.answer}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
