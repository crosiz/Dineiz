"use client";

import React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

const FAQ_DATA = [
  {
    question: "Can I change my plan anytime?",
    answer: "Yes, upgrade takes effect immediately. Downgrade takes effect at your next billing date."
  },
  {
    question: "How do I pay for the subscription?",
    answer: "JazzCash, EasyPaisa, debit/credit card, or annual bank transfer. Monthly reminders sent via WhatsApp and email."
  },
  {
    question: "What happens when my free trial ends?",
    answer: "You continue with the free features of that plan. To restore premium features, subscribe from the dashboard."
  },
  {
    question: "Is there a setup fee?",
    answer: "Never. No setup fees, no onboarding fees, no hidden charges."
  },
  {
    question: "Do you offer refunds?",
    answer: "Yes. 7-day refund for monthly plans. 30-day prorated refund for annual plans."
  },
  {
    question: "Can multiple cashiers use Dineiz POS simultaneously?",
    answer: "Yes, any number of tablets can be connected simultaneously. Each cashier logs in with their own PIN."
  },
  {
    question: "Does Dineiz work without internet?",
    answer: "Yes. The POS works offline and syncs automatically when the connection returns."
  },
  {
    question: "What support do I get?",
    answer: "All plans get community support. Go Pro and above get WhatsApp support. Enterprise gets a dedicated account manager."
  }
];

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
          {FAQ_DATA.map((item, index) => (
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
