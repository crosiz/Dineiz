import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  priceLabel?: string;
  cta: string;
  ctaLink: string;
  color: string;
  isPopular?: boolean;
  features: {
    included: string[];
    excluded: string[];
  };
};

interface PlanCardProps {
  plan: Plan;
  billingCycle: "monthly" | "annual";
}

export function PlanCard({ plan, billingCycle }: PlanCardProps) {
  const isAnnual = billingCycle === "annual";
  const displayPrice =
    plan.monthlyPrice === null
      ? plan.priceLabel
      : isAnnual
      ? plan.annualPrice
      : plan.monthlyPrice;

  // Strikethrough price for annual
  const hasStrikethrough = isAnnual && plan.monthlyPrice !== null && plan.monthlyPrice > 0;

  return (
    <div
      className={`relative flex flex-col h-full rounded-[20px] border bg-white overflow-hidden transition-all duration-300 ${
        plan.isPopular
          ? "border-[#FF6B35] shadow-[0_0_0_1px_rgba(255,107,53,0.15),0_8px_32px_rgba(255,107,53,0.08)] transform lg:-translate-y-3"
          : "border-[#E5E7EB] hover:border-gray-300"
      }`}
    >
      {/* Top Most Popular Strip */}
      {plan.isPopular && (
        <div className="bg-[#FF6B35] text-white text-[11px] font-bold tracking-widest uppercase text-center py-1.5 px-4 shrink-0">
          Most Popular
        </div>
      )}

      <div className="p-[32px] flex flex-col flex-grow">
        {/* Header */}
        <div className="mb-6 flex-shrink-0">
          <h3
            className="text-[14px] font-bold uppercase tracking-[0.08em] mb-4"
            style={{ color: plan.color }}
          >
            {plan.name}
          </h3>
          
          <div className="flex flex-col mb-2 min-h-[60px]">
            {hasStrikethrough && (
              <span className="text-[13px] text-gray-400 line-through font-medium mb-1">
                Rs {plan.monthlyPrice?.toLocaleString()}/mo
              </span>
            )}
            <div className="flex items-baseline gap-1">
              {displayPrice !== "Custom" && (
                <span className="text-[16px] font-semibold text-gray-500">Rs</span>
              )}
              <span className="text-[42px] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                {displayPrice === "Custom" ? "Custom" : displayPrice?.toLocaleString()}
              </span>
              {displayPrice !== "Custom" && (
                <span className="text-[15px] font-medium text-gray-500">
                  {isAnnual ? "/yr" : "/mo"}
                </span>
              )}
            </div>
          </div>

          <p className="text-[14px] text-[#6B7280] leading-snug min-h-[44px]">
            {plan.tagline}
          </p>
        </div>

        <hr className="border-gray-100 mb-8" />

        {/* Features */}
        <ul className="flex flex-col gap-4 flex-grow mb-8">
          {plan.features.included.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <Check size={16} strokeWidth={3} className={plan.isPopular ? "text-[#FF6B35]" : "text-[#0A0A0A]"} />
              </div>
              <span className="text-[14px] text-[#374151] font-medium leading-snug">
                {feature}
              </span>
            </li>
          ))}
          {plan.features.excluded.map((feature, idx) => (
            <li key={`ex-${idx}`} className="flex items-start gap-3 opacity-50 grayscale">
              <div className="mt-0.5 shrink-0">
                <Check size={16} strokeWidth={3} className="text-gray-400" />
              </div>
              <span className="text-[14px] text-gray-500 font-medium leading-snug line-through">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <div className="mt-auto pt-6">
          <Link
            href={plan.ctaLink}
            className={`flex items-center justify-center w-full h-[48px] rounded-xl text-[14px] font-bold transition-all ${
              plan.isPopular
                ? "bg-[#FF6B35] text-white hover:bg-[#e65a25]"
                : "bg-[#0A0A0A] text-white hover:bg-gray-800"
            }`}
          >
            {plan.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
