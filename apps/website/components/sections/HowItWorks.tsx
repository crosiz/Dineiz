import { Smartphone, ClipboardList, Receipt, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Smartphone,
    title: "Sign up in 2 minutes",
    desc: "Create your Dineiz account with just a phone number. No contracts, no hardware purchase required.",
  },
  {
    icon: ClipboardList,
    title: "Add your menu",
    desc: "Add categories, items, and prices. Import from an existing list or let our team set it up — free of charge.",
  },
  {
    icon: Receipt,
    title: "Start billing",
    desc: "Open the app on any device, connect your printer, and begin taking orders. Average setup: 14 minutes.",
  },
  {
    icon: TrendingUp,
    title: "Grow with data",
    desc: "Use Dineiz Console to monitor sales, track staff, and make decisions backed by real numbers every day.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">

        <div className="mb-16 max-w-xl">
          <p className="text-sm font-semibold text-brand-700 tracking-wide mb-4">Getting started</p>
          <h2
            className="font-bold text-[#1d1d1f]"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Up and running in under 15 minutes.
          </h2>
        </div>

        <div className="relative max-w-2xl">
          <div className="absolute left-[23px] top-3 bottom-3 w-px bg-[#e5e5ea]" aria-hidden="true" />
          <div className="space-y-10">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative flex gap-6">
                  <div className="relative z-10 shrink-0 w-12 h-12 rounded-full bg-white border-2 border-[#1d1d1f] flex items-center justify-center">
                    <Icon size={18} className="text-[#1d1d1f]" />
                  </div>
                  <div className="pt-2">
                    <h3 className="text-lg font-bold text-[#1d1d1f] mb-1.5">{s.title}</h3>
                    <p className="text-[15px] text-[#6e6e73] leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
