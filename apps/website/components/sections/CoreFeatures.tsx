"use client";
import { useState } from "react";
import { motion } from "framer-motion";

const initialTables = [
  { n: 1, occupied: false }, { n: 2, occupied: true }, { n: 3, occupied: true }, { n: 4, occupied: false },
  { n: 5, occupied: true }, { n: 6, occupied: false }, { n: 7, occupied: false }, { n: 8, occupied: true },
  { n: 9, occupied: false }, { n: 10, occupied: true }, { n: 11, occupied: false }, { n: 12, occupied: false },
];

function TableFloorPlanVisual() {
  const [tables, setTables] = useState(initialTables);
  const occupiedCount = tables.filter((t) => t.occupied).length;

  const toggleTable = (n: number) => {
    setTables((prev) => prev.map((t) => (t.n === n ? { ...t, occupied: !t.occupied } : t)));
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-card-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold text-[#1d1d1f]">Floor Plan</span>
        <span className="text-xs text-[#9a9a9f] tabular-nums">{occupiedCount} of {tables.length} occupied</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        {tables.map((t) => (
          <button
            key={t.n}
            type="button"
            onClick={() => toggleTable(t.n)}
            aria-pressed={t.occupied}
            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
              t.occupied
                ? "bg-[#FF6B35] text-white hover:bg-[#e65a25]"
                : "bg-[#f5f5f7] text-[#9a9a9f] border border-[#e5e5ea] hover:bg-[#eceef0]"
            }`}
          >
            {t.n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-[#6e6e73] pt-4 border-t border-[#f0f0f0]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FF6B35]" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#f5f5f7] border border-[#e5e5ea]" /> Free</span>
        <span className="ml-auto text-[10px] text-[#c2c2c7]">Tap a table to try it</span>
      </div>
    </div>
  );
}

const dailyStats = [
  { day: "Mon", height: 40, revenue: "Rs. 37.2K", orders: 68, avgTicket: "Rs. 547" },
  { day: "Tue", height: 65, revenue: "Rs. 60.8K", orders: 104, avgTicket: "Rs. 585" },
  { day: "Wed", height: 45, revenue: "Rs. 42.5K", orders: 74, avgTicket: "Rs. 574" },
  { day: "Thu", height: 80, revenue: "Rs. 74.8K", orders: 126, avgTicket: "Rs. 594" },
  { day: "Fri", height: 55, revenue: "Rs. 51.6K", orders: 89, avgTicket: "Rs. 580" },
  { day: "Sat", height: 90, revenue: "Rs. 84.2K", orders: 142, avgTicket: "Rs. 593" },
  { day: "Sun", height: 70, revenue: "Rs. 65.4K", orders: 110, avgTicket: "Rs. 595" },
];

function AnalyticsVisual() {
  const [selected, setSelected] = useState(5);
  const active = dailyStats[selected];

  return (
    <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-card-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-bold text-[#1d1d1f]">{active.day}&apos;s Overview</span>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <div className="text-[10px] text-[#9a9a9f] mb-1">Revenue</div>
          <div className="text-lg font-bold text-[#1d1d1f] tabular-nums">{active.revenue}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#9a9a9f] mb-1">Orders</div>
          <div className="text-lg font-bold text-[#1d1d1f] tabular-nums">{active.orders}</div>
        </div>
        <div>
          <div className="text-[10px] text-[#9a9a9f] mb-1">Avg Ticket</div>
          <div className="text-lg font-bold text-[#1d1d1f] tabular-nums">{active.avgTicket}</div>
        </div>
      </div>
      <div className="flex items-end gap-2 h-20 pt-4 border-t border-[#f0f0f0]">
        {dailyStats.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setSelected(i)}
            aria-label={`${d.day}: ${d.revenue} revenue, ${d.orders} orders`}
            aria-pressed={i === selected}
            className="flex-1 h-full flex items-end group"
          >
            <div
              className={`w-full rounded-t-md transition-opacity ${
                i === selected ? "bg-[#FF6B35] opacity-100" : "bg-[#FF6B35] opacity-25 group-hover:opacity-50"
              }`}
              style={{ height: `${d.height}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-1.5">
        {dailyStats.map((d, i) => (
          <span
            key={d.day}
            className={`flex-1 text-center text-[9px] font-medium ${i === selected ? "text-[#1d1d1f]" : "text-[#c2c2c7]"}`}
          >
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}

const features = [
  {
    label: "Point of Sale",
    headline: "Billing in seconds.",
    desc: "A single screen for dine-in, takeaway, and delivery. Split bills, apply discounts, and generate itemized GST receipts instantly. Works fully offline.",
    visual: (
      <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-card-lg p-6">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#f0f0f0]">
          <span className="text-sm font-bold text-[#1d1d1f]">Table 7 — Dine In</span>
          <span className="text-xs text-[#9a9a9f]">Order #4821</span>
        </div>
        <div className="space-y-3 mb-5">
          {[
            { name: "Chicken Biryani — Full", qty: 2, price: "Rs. 800" },
            { name: "Seekh Kabab (4 pcs)", qty: 1, price: "Rs. 340" },
            { name: "Chicken Karahi", qty: 1, price: "Rs. 950" },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-md bg-[#f5f5f7] text-[#1d1d1f] text-xs font-bold flex items-center justify-center shrink-0">
                  {item.qty}
                </span>
                <span className="text-sm text-[#1d1d1f] font-medium">{item.name}</span>
              </div>
              <span className="text-sm text-[#6e6e73] tabular-nums">{item.price}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f0] mb-5">
          <span className="text-base font-bold text-[#1d1d1f]">Total</span>
          <span className="text-base font-bold text-[#1d1d1f] tabular-nums">Rs. 2,090</span>
        </div>
        <div className="w-full py-3 bg-[#FF6B35] text-white text-sm font-semibold rounded-xl text-center">
          Charge
        </div>
      </div>
    ),
  },
  {
    label: "Kitchen Display",
    headline: "No more paper slips.",
    desc: "Orders appear on the kitchen screen the moment they are placed. Color-coded wait times keep your kitchen organized. One tap to mark complete.",
    visual: (
      <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-card-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-bold text-[#1d1d1f]">Kitchen Display</span>
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#fafafa] border border-[#e5e5ea] rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1d1d1f]">Table 4</span>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">6 min</span>
            </div>
            <div className="space-y-1 text-xs text-[#6e6e73]">
              <div>2× Chicken Karahi</div>
              <div>4× Naan</div>
            </div>
          </div>
          <div className="bg-[#fafafa] border border-[#e5e5ea] rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1d1d1f]">Takeaway</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Ready</span>
            </div>
            <div className="space-y-1 text-xs text-[#6e6e73]">
              <div>1× Biryani Full</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "Table Management",
    headline: "Know your floor at a glance.",
    desc: "A visual floor plan shows which tables are free, occupied, or ready for the bill — updated in real time as staff punch orders and close tickets.",
    visual: <TableFloorPlanVisual />,
  },
  {
    label: "Analytics",
    headline: "Real-time numbers.",
    desc: "Open your phone to see today's revenue, top-selling items, and staff performance. Monitor all your branches from a single dashboard.",
    visual: <AnalyticsVisual />,
  },
];

export function CoreFeatures() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        <div className="mb-20 max-w-2xl">
          <h2
            className="font-bold text-[#1d1d1f] mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Core features.
          </h2>
          <p className="text-[#6e6e73] text-lg">
            Everything you need to run your restaurant, without the clutter.
          </p>
        </div>

        <div className="space-y-24 lg:space-y-28">
          {features.map((feat, i) => (
            <div key={feat.label} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
                className={i % 2 === 1 ? "lg:order-2" : ""}
              >
                <p className="text-[11px] font-bold text-[#FF6B35] uppercase tracking-widest mb-3">
                  {feat.label}
                </p>
                <h3 className="text-[28px] lg:text-[32px] font-bold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
                  {feat.headline}
                </h3>
                <p className="text-[#6e6e73] text-base leading-relaxed max-w-md">
                  {feat.desc}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className={i % 2 === 1 ? "lg:order-1" : ""}
              >
                {feat.visual}
              </motion.div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
