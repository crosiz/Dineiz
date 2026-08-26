import React from "react";
import { Check, Minus } from "lucide-react";

type FeatureValue = boolean | string;

interface TableCategory {
  category: string;
  features: {
    name: string;
    goFree: FeatureValue;
    goPro: FeatureValue;
    starter: FeatureValue;
    pro: FeatureValue;
    enterprise: FeatureValue;
  }[];
}

const TABLE_DATA: TableCategory[] = [
  {
    category: "Order Management",
    features: [
      { name: "Create Orders", goFree: true, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Daily Order Limit", goFree: "30", goPro: "Unlimited", starter: "Unlimited", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Table Map", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
      { name: "Kitchen Display (KDS)", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
      { name: "Hold Orders", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Split Bill", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
    ]
  },
  {
    category: "Payments",
    features: [
      { name: "Cash", goFree: true, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Card Terminal", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "GST Tax Configuration", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
    ]
  },
  {
    category: "Staff & Security",
    features: [
      { name: "Staff Accounts", goFree: "1", goPro: "2", starter: "5", pro: "15", enterprise: "Unlimited" },
      { name: "Roles & Permissions", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
      { name: "Shift Management", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
      { name: "Audit Log", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Fraud Detection", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
    ]
  },
  {
    category: "Menu & Inventory",
    features: [
      { name: "Categories", goFree: true, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Variations", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Basic Inventory", goFree: false, goPro: false, starter: true, pro: true, enterprise: true },
      { name: "Recipes & Costing", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Purchase Orders", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
    ]
  },
  {
    category: "Analytics & Reports",
    features: [
      { name: "Report History", goFree: "1 Day", goPro: "30 Days", starter: "90 Days", pro: "365 Days", enterprise: "Unlimited" },
      { name: "Real-time Stats", goFree: true, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Custom Reports", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Forecasting", goFree: false, goPro: false, starter: false, pro: false, enterprise: true },
    ]
  },
  {
    category: "Growth Tools",
    features: [
      { name: "CRM", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Loyalty Program", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "Deals & Promotions", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "WhatsApp Bot", goFree: false, goPro: true, starter: true, pro: true, enterprise: true },
      { name: "QR Ordering", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
    ]
  },
  {
    category: "Integrations",
    features: [
      { name: "Foodpanda", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Careem", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "Webhooks", goFree: false, goPro: false, starter: false, pro: true, enterprise: true },
      { name: "API Access", goFree: false, goPro: false, starter: false, pro: false, enterprise: true },
    ]
  },
  {
    category: "Support",
    features: [
      { name: "Email", goFree: "Community", goPro: "Standard", starter: "48h Response", pro: "Priority", enterprise: "Priority" },
      { name: "WhatsApp", goFree: false, goPro: true, starter: true, pro: "24h Response", enterprise: "4h Response" },
      { name: "Dedicated Manager", goFree: false, goPro: false, starter: false, pro: false, enterprise: true },
    ]
  },
];

const RenderValue = ({ val, isHighlighted }: { val: FeatureValue; isHighlighted?: boolean }) => {
  if (typeof val === "boolean") {
    return val ? (
      <Check size={18} className={`mx-auto ${isHighlighted ? 'text-[#FF6B35]' : 'text-[#1A1A1A]'}`} strokeWidth={3} />
    ) : (
      <Minus size={18} className="text-gray-300 mx-auto" />
    );
  }
  return <span className="text-[13px] font-semibold text-gray-800">{val}</span>;
};

export function ComparisonTable() {
  const plans = [
    { name: "Go Free", tagline: "For dhabas", highlighted: false },
    { name: "Go Pro", tagline: "For small restaurants", highlighted: false },
    { name: "Starter", tagline: "For restaurants with a counter", highlighted: true },
    { name: "Pro", tagline: "For multi-branch restaurants", highlighted: false },
    { name: "Enterprise", tagline: "For restaurant chains", highlighted: false },
  ];

  return (
    <section className="bg-[#F9FAFB] py-[100px] w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-[#0A0A0A]">
            Full Feature Comparison
          </h2>
        </div>

        <div className="w-full overflow-x-auto pb-8">
          <div className="min-w-[900px] border border-gray-200 rounded-[20px] bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-white p-6 min-w-[200px] border-b border-gray-200">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Feature</span>
                  </th>
                  {plans.map((plan, i) => (
                    <th key={i} className={`p-6 text-center border-b border-gray-200 min-w-[140px] ${plan.highlighted ? 'bg-[#fff8f5]' : 'bg-white'}`}>
                      <div className={`font-bold text-[16px] ${plan.highlighted ? 'text-[#FF6B35]' : 'text-gray-900'}`}>
                        {plan.name}
                      </div>
                      <div className="text-[12px] text-gray-500 font-normal mt-1.5 leading-snug">
                        {plan.tagline}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_DATA.map((group, groupIndex) => (
                  <React.Fragment key={groupIndex}>
                    {/* Category Header Row */}
                    <tr>
                      <td
                        colSpan={6}
                        className="bg-gray-50 p-4 px-6 font-bold text-[13px] text-gray-900 uppercase tracking-wider border-y border-gray-200 sticky left-0 z-10"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {/* Feature Rows */}
                    {group.features.map((feature, idx) => (
                      <tr key={idx} className="group hover:bg-gray-50 transition-colors odd:bg-white even:bg-[#FAFAFA]">
                        <td className="sticky left-0 z-10 p-4 px-6 text-[14px] font-medium text-gray-700 border-b border-gray-100 group-odd:bg-white group-even:bg-[#FAFAFA] group-hover:bg-gray-50 transition-colors">
                          {feature.name}
                        </td>
                        <td className="p-4 text-center border-b border-gray-100"><RenderValue val={feature.goFree} /></td>
                        <td className="p-4 text-center border-b border-gray-100"><RenderValue val={feature.goPro} /></td>
                        <td className="p-4 text-center border-b border-gray-100 bg-[#fff8f5]"><RenderValue val={feature.starter} isHighlighted /></td>
                        <td className="p-4 text-center border-b border-gray-100"><RenderValue val={feature.pro} /></td>
                        <td className="p-4 text-center border-b border-gray-100"><RenderValue val={feature.enterprise} /></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
