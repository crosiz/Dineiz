import { Check, Download } from "lucide-react";
import { DineizMark } from "@/components/ui/DineizMark";

export function OfflineFirst() {
  return (
    <section className="bg-[#161616] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        <div className="max-w-xl mb-14">
          <p className="text-sm font-semibold text-brand-400 tracking-wide mb-4">Built offline-first</p>
          <h2
            className="font-bold text-white mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Works even when the internet doesn&apos;t.
          </h2>
          <p className="text-[#a1a1a6] text-base leading-relaxed">
            Load-shedding and patchy connections are normal here — so Dineiz keeps billing
            without them. No plan, no add-on. Just how it works.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Offline sync */}
          <div className="bg-[#1f1f1f] border border-[#2e2e2e] rounded-2xl p-7">
            <p className="text-sm font-semibold text-white mb-2">
              Every order, saved on the device first
            </p>
            <p className="text-sm text-[#a1a1a6] leading-relaxed mb-6">
              A dropped connection never stops an order — it queues locally and syncs
              itself the moment you're back online.
            </p>
            <div className="bg-[#161616] border border-[#2e2e2e] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3.5 pb-3.5 border-b border-[#2e2e2e]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-[#e5e5e7]">No internet connection</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { id: "Order #142", status: "queued" },
                  { id: "Order #143", status: "queued" },
                  { id: "Order #144", status: "synced" },
                ].map((o) => (
                  <div key={o.id} className="flex items-center justify-between">
                    <span className="text-sm text-[#e5e5e7]">{o.id}</span>
                    {o.status === "synced" ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <Check size={12} strokeWidth={3} /> Synced
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#8a8a8f]">Queued</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PWA install */}
          <div className="bg-[#1f1f1f] border border-[#2e2e2e] rounded-2xl p-7">
            <p className="text-sm font-semibold text-white mb-2">
              Install it like an app — no store needed
            </p>
            <p className="text-sm text-[#a1a1a6] leading-relaxed mb-6">
              Open Dineiz in the browser on whatever hardware you already own, and
              choose Install. Updates ship instantly — no manual downloads, ever.
            </p>
            <div className="bg-[#161616] border border-[#2e2e2e] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <DineizMark size={22} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Install Dineiz POS?</div>
                  <div className="text-xs text-[#8a8a8f]">pos.dineiz.com</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 py-2 rounded-lg border border-[#2e2e2e] text-center text-xs font-medium text-[#a1a1a6]">
                  Cancel
                </div>
                <div className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-center text-xs font-semibold text-white flex items-center justify-center gap-1.5">
                  <Download size={12} strokeWidth={2.5} /> Install
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
