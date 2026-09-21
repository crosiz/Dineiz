"use client";

import { useState } from "react";
import { ChevronDown, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { FAQS } from "@/mocks/help";

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Help & Support" description="Answers to common questions, and ways to reach us" />
      <div className="grid grid-cols-[1fr_320px] gap-4 px-6 pb-6">
        <div>
          <SectionTitle>Frequently Asked</SectionTitle>
          <Card className="overflow-hidden">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.question} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
                  >
                    <span className="text-[13px] font-medium text-text-1">{faq.question}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-3 transition-transform", isOpen && "rotate-180")} strokeWidth={1.75} />
                  </button>
                  {isOpen && <p className="px-4 pb-4 text-[13px] text-text-2">{faq.answer}</p>}
                </div>
              );
            })}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-tint">
              <LifeBuoy className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </span>
            <span className="text-[13px] font-semibold text-text-1">Need more help?</span>
            <p className="text-xs text-text-2">Our support team is available every day, 9 AM – 11 PM.</p>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="flex items-center gap-2 text-xs text-text-2">
                <Phone className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
                +92 21 111 000 111
              </span>
              <span className="flex items-center gap-2 text-xs text-text-2">
                <Mail className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
                support@dineiz.com
              </span>
              <span className="flex items-center gap-2 text-xs text-text-2">
                <MessageCircle className="h-3.5 w-3.5 text-text-3" strokeWidth={1.75} />
                Live chat in-app
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
