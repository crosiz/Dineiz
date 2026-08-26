const steps = [
  {
    step: "01",
    title: "Sign up in 2 minutes",
    desc: "Create your Dineiz account with just a phone number. No contracts, no hardware purchase required.",
  },
  {
    step: "02",
    title: "Add your menu",
    desc: "Add categories, items, and prices. Import from an existing list or let our team set it up — free of charge.",
  },
  {
    step: "03",
    title: "Start billing",
    desc: "Open the app on any device, connect your printer, and begin taking orders. Average setup: 14 minutes.",
  },
  {
    step: "04",
    title: "Grow with data",
    desc: "Use Dineiz Console to monitor sales, track staff, and make decisions backed by real numbers every day.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">

        <div className="mb-16 max-w-xl">
          <p className="text-sm font-semibold text-brand-500 tracking-wide mb-4">Getting started</p>
          <h2
            className="font-bold text-[#1d1d1f]"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Up and running in under 15 minutes.
          </h2>
        </div>

        <div className="divide-y divide-[#eceef1] border-t border-b border-[#eceef1]">
          {steps.map((s) => (
            <div key={s.step} className="sm:flex gap-2 sm:gap-8 py-8 sm:items-baseline">
              <span
                className="block sm:w-24 shrink-0 text-[#d2d2d7] font-bold tabular-nums"
                style={{ fontSize: "2.75rem", letterSpacing: "-0.02em", lineHeight: 1 }}
              >
                {s.step}
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">{s.title}</h3>
                <p className="text-[15px] text-[#6e6e73] leading-relaxed max-w-md">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
