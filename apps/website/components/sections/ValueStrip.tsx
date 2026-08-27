import { WifiOff, Receipt, Smartphone, Gift } from "lucide-react";

const items = [
  { icon: WifiOff, label: "Works offline" },
  { icon: Receipt, label: "GST built in" },
  { icon: Smartphone, label: "Runs on any Android phone" },
  { icon: Gift, label: "Free plan available" },
];

export function ValueStrip() {
  return (
    <section className="bg-[#fafafa] border-y border-[#eceef1] py-6">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-8 gap-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2 text-[#4a4a4f]">
                <Icon size={16} className="text-[#9a9a9f] shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
