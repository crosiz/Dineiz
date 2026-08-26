export function OfflineFirst() {
  return (
    <section className="bg-[#161616] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">

        {/* Header — left aligned, breaks from the centered recipe used elsewhere */}
        <div className="max-w-xl mb-14">
          <p className="text-sm font-semibold text-brand-400 tracking-wide mb-4">Built offline-first</p>
          <h2
            className="font-bold text-white mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}
          >
            Works even when the internet doesn&apos;t.
          </h2>
          <p className="text-[#a1a1a6] text-base leading-relaxed">
            Load-shedding and patchy connections are normal here — so Dineiz is built to keep
            billing without them. No plan, no add-on. Just how it works.
          </p>
        </div>

        {/* Two honest, factual explanation cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1f1f1f] border border-[#2e2e2e] rounded-2xl p-7">
            <p className="text-sm font-semibold text-white mb-3">
              A local database, not a queue
            </p>
            <p className="text-sm text-[#a1a1a6] leading-relaxed mb-4">
              Dineiz stores your menu on the device using <span className="font-medium text-white">Dexie.js
              (IndexedDB)</span> with a Workbox service worker, which means:
            </p>
            <ul className="space-y-2.5">
              {[
                "Full menu available locally on the device",
                "Orders punched offline queue locally",
                "Background sync pushes them the moment internet returns",
                "No data loss even if the tab or app is closed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[#e5e5e7]">
                  <span className="w-1 h-1 rounded-full bg-brand-400 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#1f1f1f] border border-[#2e2e2e] rounded-2xl p-7">
            <p className="text-sm font-semibold text-white mb-3">
              Install it like an app — no store needed
            </p>
            <p className="text-sm text-[#a1a1a6] leading-relaxed mb-4">
              Dineiz is a <span className="font-medium text-white">Progressive Web App</span>, so it
              installs directly from the browser on whatever hardware you already own:
            </p>
            <ul className="space-y-3">
              {[
                { device: "Windows PC", detail: "Open Chrome → go to pos.dineiz.com → Install. Its own icon, its own window." },
                { device: "Android tablet", detail: "Same install from Chrome — no Play Store trip needed." },
                { device: "iPad or iPhone", detail: "Same install from Safari." },
              ].map((item) => (
                <li key={item.device} className="text-sm">
                  <span className="font-semibold text-white">{item.device}: </span>
                  <span className="text-[#a1a1a6]">{item.detail}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[#a1a1a6] mt-4 pt-4 border-t border-[#2e2e2e]">
              Updates push instantly — nobody has to manually update anything.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
