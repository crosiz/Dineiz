const categories = [
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
  return (
    <section className="bg-[#fafafa] border-y border-[#eceef1] py-8">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9a9a9f] shrink-0">
          Built for
        </p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-2">
          {categories.map((name) => (
            <span key={name} className="text-sm text-[#4a4a4f]">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
