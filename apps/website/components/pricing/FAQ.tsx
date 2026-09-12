"use client";

import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { PRICING_FAQS } from "@/lib/plans";

export function FAQ() {
  return (
    <section className="bg-[#F9FAFB] py-[100px] w-full border-t border-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-12">
          <h2 className="text-[32px] md:text-[40px] font-bold text-[#0A0A0A]">
            Frequently Asked Questions
          </h2>
        </div>

        <Accordion.Root type="single" collapsible className="flex flex-col gap-4">
          {PRICING_FAQS.map((item, index) => (
            <Accordion.Item 
              key={index} 
              value={`item-${index}`}
              className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm"
            >
              <Accordion.Header className="flex">
                <Accordion.Trigger className="flex-1 flex items-center justify-between p-6 text-[16px] md:text-[18px] font-semibold text-gray-900 hover:text-[#FF6B35] transition-colors group">
                  <span className="text-left">{item.question}</span>
                  <ChevronDown 
                    size={20} 
                    className="text-gray-400 group-hover:text-[#FF6B35] transition-transform duration-300 ease-[cubic-bezier(0.87,_0,_0.13,_1)] group-data-[state=open]:rotate-180" 
                  />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden text-[15px] text-gray-600 leading-relaxed data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="px-6 pb-6 pt-0">
                  {item.answer}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>

      </div>
      
      <style jsx global>{`
        @keyframes accordion-down {
          from { height: 0; opacity: 0; }
          to { height: var(--radix-accordion-content-height); opacity: 1; }
        }
        @keyframes accordion-up {
          from { height: var(--radix-accordion-content-height); opacity: 1; }
          to { height: 0; opacity: 0; }
        }
        .animate-accordion-down {
          animation: accordion-down 300ms cubic-bezier(0.87, 0, 0.13, 1);
        }
        .animate-accordion-up {
          animation: accordion-up 300ms cubic-bezier(0.87, 0, 0.13, 1);
        }
      `}</style>
    </section>
  );
}
