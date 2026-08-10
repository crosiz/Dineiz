"use client";
import { Check, Minus } from "lucide-react";

const features = [
  { label: "FBR Certified (Pakistan)" },
  { label: "Works on PC & Laptop" },
  { label: "Works on iPad & iPhone" },
  { label: "Works on Android Tablet" },
  { label: "Full Offline Mode" },
  { label: "JazzCash & EasyPaisa" },
  { label: "WhatsApp AI Ordering" },
  { label: "Kitchen Display (KDS)" },
  { label: "Multi-Branch Dashboard" },
  { label: "Instant Over-the-Air Updates" },
];

const competitors = [
  {
    name: "Dineiz",
    sub: "PWA — any device",
    highlight: true,
    values: [true, true, true, true, true, true, true, true, true, true],
  },
  {
    name: "Blink POS",
    sub: "Android tablet only",
    highlight: false,
    values: [true, false, false, "partial", "partial", false, false, true, true, false],
  },
  {
    name: "Square / Toast",
    sub: "Not Pakistan-ready",
    highlight: false,
    values: [false, true, true, true, false, false, false, true, true, true],
  },
  {
    name: "Manual / Khata",
    sub: "Paper-based",
    highlight: false,
    values: [false, false, false, false, false, false, false, false, false, false],
  },
];

function Cell({ value, highlight }: { value: boolean | string; highlight: boolean }) {
  if (value === true) {
    return (
      <Check
        size={15}
        strokeWidth={2.5}
        className={`mx-auto ${highlight ? "text-[#FF6B35]" : "text-[#1d1d1f]"}`}
      />
    );
  }
  if (value === "partial") {
    return <Minus size={15} className="mx-auto text-[#6e6e73]" strokeWidth={2} />;
  }
  return <span className="block w-3 h-px bg-[#d2d2d7] mx-auto rounded-full" />;
}

export function CompareCompetitors() {
  return (
    <section className="bg-[#f5f5f7] py-24 lg:py-32 border-y border-[#d2d2d7]">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[#FF6B35] tracking-wide mb-4">Comparison</p>
          <h2
            className="font-bold text-[#1d1d1f] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Why restaurants switch to Dineiz.
          </h2>
          <p className="text-[#6e6e73] text-base max-w-2xl mx-auto">
            Blink POS only runs on one Android tablet, has no JazzCash support, 
            and stops working when internet drops. Dineiz runs everywhere — and keeps working offline.
          </p>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl border border-[#d2d2d7] overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-[#e5e5ea]">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-[#6e6e73] uppercase tracking-wider w-48">
                    Feature
                  </th>
                  {competitors.map((c) => (
                    <th
                      key={c.name}
                      className={`px-4 py-4 text-center ${c.highlight ? "bg-[#fff8f5]" : ""}`}
                    >
                      <div className={`text-sm font-bold ${c.highlight ? "text-[#FF6B35]" : "text-[#1d1d1f]"}`}>
                        {c.name}
                      </div>
                      <div className="text-[11px] text-[#6e6e73] font-normal mt-0.5">{c.sub}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature, i) => (
                  <tr
                    key={feature.label}
                    className={`border-b border-[#f5f5f7] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}
                  >
                    <td className="px-6 py-3.5 text-sm font-medium text-[#1d1d1f]">{feature.label}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className={`px-4 py-3.5 text-center ${c.highlight ? "bg-[#fff8f5]" : ""}`}>
                        <Cell value={c.values[i]} highlight={c.highlight} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two callout cards */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Offline mode explanation */}
          <div className="bg-white border border-[#d2d2d7] rounded-2xl p-7">
            <p className="text-sm font-semibold text-[#1d1d1f] mb-3">
              Offline mode — better than Blink&apos;s
            </p>
            <p className="text-sm text-[#6e6e73] leading-relaxed mb-4">
              Blink&apos;s offline mode stores a limited queue locally on one Android tablet. 
              Dineiz uses <span className="font-medium text-[#1d1d1f]">Dexie.js (IndexedDB) + a Workbox service worker</span>, which means:
            </p>
            <ul className="space-y-2.5">
              {[
                "Full menu stored locally on the device",
                "Orders punched offline go into a local queue",
                "Background sync pushes them the moment internet returns",
                "Works on any device — PC, tablet, or phone",
                "No data loss even if the tab is closed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]">
                  <Check size={14} strokeWidth={2.5} className="text-[#FF6B35] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* PWA vs downloaded app */}
          <div className="bg-white border border-[#d2d2d7] rounded-2xl p-7">
            <p className="text-sm font-semibold text-[#1d1d1f] mb-3">
              PWA — more powerful than a downloaded app
            </p>
            <p className="text-sm text-[#6e6e73] leading-relaxed mb-4">
              Blink POS is Android tablet only — downloaded from the Play Store. Cannot run on PC. 
              Dineiz is a <span className="font-medium text-[#1d1d1f]">PWA (Progressive Web App)</span>:
            </p>
            <ul className="space-y-3">
              {[
                { device: "Windows PC", detail: "Open Chrome → go to pos.dineiz.com → click Install → it installs like a desktop app. Its own icon, its own window, works offline." },
                { device: "Android tablet", detail: "Same install from Chrome. No Play Store needed." },
                { device: "iPad or iPhone", detail: "Same install from Safari." },
              ].map((item) => (
                <li key={item.device} className="text-sm">
                  <span className="font-semibold text-[#1d1d1f]">{item.device}: </span>
                  <span className="text-[#6e6e73]">{item.detail}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[#6e6e73] mt-4 pt-4 border-t border-[#f5f5f7]">
              Updates push instantly — the restaurant never needs to manually update anything.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
