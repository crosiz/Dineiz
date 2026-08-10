"use client";

const logos = [
  "Cafés & Coffee Shops",
  "Fine Dining",
  "Dhabas & Street Food",
  "Fast Food Chains",
  "Food Carts",
  "Bakeries",
  "Cloud Kitchens",
  "Food Trucks",
];

export function LogoBar() {
  const doubled = [...logos, ...logos];

  return (
    <section className="bg-gray-50 border-y border-gray-100 py-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 text-center mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Built for food businesses across Pakistan
        </p>
      </div>
      <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]">
        <div className="flex gap-10 animate-marquee whitespace-nowrap">
          {doubled.map((name, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
