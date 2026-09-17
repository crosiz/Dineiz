'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Lock, User, MonitorSmartphone,
  RefreshCw, ExternalLink, Download, Usb, Bluetooth, Printer, Unplug,
} from 'lucide-react';
import { getPosSession } from '@/lib/pos-session';
import { useBrandingStore } from '@/lib/branding-store';
import { useTerminalSettings } from '@/lib/terminal-settings';
import { usePrinter } from '@/hooks/usePrinter';
import { useViews, resolveLocalOrderId } from '@/lib/core/views';
import {
  getUnsyncedSummary, getSyncDiagnostics, forceSyncNow, discardStuckEvent,
  type UnsyncedSummary,
} from '@/lib/core/outbox';

const APP_VERSION = '0.1.0';

// Four sections, each one a real page's worth of content.
//
// This was previously fourteen — Account / Change PIN / Language / Printer /
// Display / Sound / Cash Drawer / Sync Status / Offline Queue / Storage /
// Current Shift / Breaks / Managed / Version / Diagnostics — where most panes
// held a single control ("Language" was one dropdown; "Diagnostics" was one
// button) and half of them were read-only shift figures that belong on the
// shift screens, not in Settings. That structure looked organised and was
// useless to operate: every tap landed on a nearly-empty pane.
//
// The grouping now follows the only distinction that actually matters here —
// WHO OWNS the setting, which is also what determines whether you can change
// it: you (account), this device (terminal-local, never synced), the sync
// engine's own state, and the console (read-only).
type SectionId = 'account' | 'terminal' | 'sync' | 'managed';

const NAV: Array<{ id: SectionId; label: string; hint: string; Icon: any }> = [
  { id: 'account', label: 'Account', hint: 'You, your PIN, your session', Icon: User },
  { id: 'terminal', label: 'This Terminal', hint: 'Printer, paper, sound, screen', Icon: MonitorSmartphone },
  { id: 'sync', label: 'Sync & Data', hint: 'Queue, storage, diagnostics', Icon: RefreshCw },
  { id: 'managed', label: 'Managed by Console', hint: 'Tax, payments, limits', Icon: Lock },
];

// Old deep links (?section=syncStatus etc.) still resolve.
const SECTION_ALIASES: Record<string, SectionId> = {
  account: 'account', changePin: 'account', language: 'account',
  terminal: 'terminal', printer: 'terminal', display: 'terminal', sound: 'terminal', cashDrawer: 'terminal',
  sync: 'sync', syncStatus: 'sync', offlineQueue: 'sync', storage: 'sync', diagnostics: 'sync', version: 'sync',
  managed: 'managed',
};

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5 border-b border-line last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {/* Capped independently of the row: a hint set to the full row width
            reads as a paragraph, not as a caption on the control beside it. */}
        {hint && <p className="text-[12px] text-ink-3 mt-1 leading-relaxed max-w-[46ch]">{hint}</p>}
      </div>
      {/* A fixed control column keeps every value on the same vertical line, so
          the eye tracks straight down the page instead of hunting for where the
          control ended up on each row. */}
      <div className="shrink-0 min-w-[150px] flex justify-end items-center gap-2 pt-0.5 text-[14px] text-ink-2 text-right">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${on ? 'bg-brand' : 'bg-hover'}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

const selectCls = 'h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-brand focus:shadow-none min-w-[140px]';
const inputCls = 'h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-brand focus:shadow-none min-w-[160px]';

export default function POSSettingsPage() {
  const router = useRouter();
  const session = getPosSession();
  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';
  const branding = useBrandingStore((s) => s.branding);
  const managed = { ...(branding.pos ?? {}), ...branding }; // pos sub-object + flat fallbacks

  const { settings, loaded, load, set } = useTerminalSettings();
  useEffect(() => { void load(); }, [load]);
  const printer = usePrinter();

  // Opens on Account by default; deep-linkable via ?section= (the top-bar
  // Settings item and the sync pill both point at specific sections).
  const searchParams = useSearchParams();
  const initialSection: SectionId = SECTION_ALIASES[searchParams.get('section') ?? ''] ?? 'account';
  const [section, setSection] = useState<SectionId>(initialSection);

  // The list and the detail pane are separate, swappable views ONLY on a
  // narrow screen. On desktop both are on screen at once, so `mobileOpen` must
  // never gate anything there — that was the "press Back twice" bug: arriving
  // via ?section= set mobileOpen=true, and on desktop the first Back press only
  // cleared that (no visible change) instead of leaving the page.
  const [isNarrow, setIsNarrow] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (isNarrow && searchParams.get('section')) setMobileOpen(true);
  }, [isNarrow, searchParams]);
  const detailOpen = isNarrow && mobileOpen;

  // ── Live sync data ─────────────────────────────────────────────────────
  const [summary, setSummary] = useState<UnsyncedSummary | null>(null);
  const [diag, setDiag] = useState<Awaited<ReturnType<typeof getSyncDiagnostics>> | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const tick = async () => {
      setSummary(await getUnsyncedSummary());
      setDiag(await getSyncDiagnostics());
      setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    };
    void tick();
    const h = setInterval(tick, 2000);
    return () => clearInterval(h);
  }, []);

  const openSection = (id: SectionId) => { setSection(id); setMobileOpen(true); };

  // The content column is CAPPED, not full-bleed.
  //
  // It used to stretch the whole pane, so on a 1280px terminal a setting's
  // label sat at x=178 and its control at x=770 — nearly 600px of eye travel
  // to connect the two, and help text set to a 90-character measure that is
  // simply hard to read. 760px is about 75 characters at this size, which is
  // the measure every settings screen worth copying (Apple, Stripe, Linear)
  // lands on.
  const panel = (
    <div className="overflow-y-auto h-full">
      <div className="max-w-[760px] px-5 sm:px-8 py-6 sm:py-8">
      {section === 'account' && (
        <>
          <h2 className="text-[18px] font-semibold text-ink mb-1">Account</h2>
          <Row label="Name">{session?.name ?? '—'}</Row>
          <Row label="Role">{session?.role ?? '—'}</Row>
          <Row label="Branch">{session?.branchName ?? session?.branchId ?? '—'}</Row>
          <Row label="Session expires" hint="This terminal signs you out automatically after this.">
            <span className="text-[13px] text-ink-2 tabular-nums">
              {session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : '—'}
            </span>
          </Row>
          <Row label="PIN" hint="Your PIN unlocks this terminal. Only a branch manager can reset it, from the console.">
            <span className="text-[13px] text-ink-4">Set by your manager</span>
          </Row>
        </>
      )}

      {section === 'terminal' && (
        <>
          <h2 className="text-[15px] font-bold text-ink mb-1">This Terminal</h2>
          <p className="text-[12px] text-ink-3 leading-relaxed mb-4">
            Stored on this device only — never synced. A terminal with a thermal printer
            attached and one without can&apos;t share these.
          </p>

          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4 mt-7 mb-1">Printing</p>
          <Row label="Print mode" hint="PDF downloads a receipt. Printer sends ESC/POS over USB or Bluetooth. System Dialog reaches a WiFi/LAN printer or an OS-paired Bluetooth one.">
            <select className={selectCls} value={settings.printMode} onChange={(e) => set('printMode', e.target.value as any)}>
              <option value="PDF">PDF</option>
              <option value="PRINTER">Printer (USB / Bluetooth)</option>
              <option value="SYSTEM">System Dialog</option>
            </select>
          </Row>
          <Row label="Paper width">
            <select className={selectCls} value={settings.paperWidth} onChange={(e) => set('paperWidth', e.target.value as any)}>
              <option value="58mm">58 mm</option>
              <option value="80mm">80 mm</option>
            </select>
          </Row>

          {settings.printMode === 'PRINTER' && (
            <>
              <Row label="Connection" hint="USB needs a cable. Bluetooth only reaches Bluetooth Low Energy printers — try System Dialog if yours doesn't pair.">
                <select
                  className={selectCls}
                  value={settings.printerTransport}
                  onChange={(e) => set('printerTransport', e.target.value as any)}
                >
                  <option value="USB">USB</option>
                  <option value="BLUETOOTH">Bluetooth</option>
                </select>
              </Row>
              <Row
                label="Printer"
                hint={
                  printer.status === 'ready' && printer.transport
                    ? `Connected — ${printer.deviceName ?? (printer.transport === 'usb' ? 'USB printer' : 'Bluetooth printer')}`
                    : printer.status === 'connecting'
                      ? 'Connecting…'
                      : settings.printerTransport === 'BLUETOOTH'
                        ? (printer.isBluetoothSupported ? 'Not connected' : "This browser can't pair Bluetooth printers (Chrome/Edge only) — try USB or System Dialog.")
                        : (printer.isUsbSupported ? 'Not connected' : "This browser can't pair USB printers (Chrome/Edge only) — try System Dialog.")
                }
              >
                {printer.status === 'ready' ? (
                  <button
                    onClick={() => printer.disconnect()}
                    className="h-9 px-3 rounded-lg border border-line bg-white text-[12px] font-semibold text-ink-2 hover:bg-sunken flex items-center gap-1.5"
                  >
                    <Unplug size={14} /> Forget
                  </button>
                ) : (
                  <button
                    onClick={() => (settings.printerTransport === 'BLUETOOTH' ? printer.connectBluetooth() : printer.connectUSB())}
                    disabled={
                      printer.status === 'connecting' ||
                      (settings.printerTransport === 'BLUETOOTH' ? !printer.isBluetoothSupported : !printer.isUsbSupported)
                    }
                    className="h-9 px-3 rounded-lg text-white text-[12px] font-bold disabled:opacity-40 flex items-center gap-1.5"
                    style={{ backgroundColor: '#FF5722' }}
                  >
                    {settings.printerTransport === 'BLUETOOTH' ? <Bluetooth size={14} /> : <Usb size={14} />}
                    {printer.status === 'connecting' ? 'Connecting…' : 'Connect'}
                  </button>
                )}
              </Row>
              {printer.error && (
                <p className="text-[11px] text-rose-600 font-medium -mt-1 mb-2">{printer.error}</p>
              )}
            </>
          )}
          {settings.printMode === 'SYSTEM' && (
            <p className="text-[11px] text-ink-4 leading-relaxed -mt-1 mb-2 flex items-start gap-1.5">
              <Printer size={13} className="shrink-0 mt-0.5" />
              Opens this tablet's print dialog for every receipt/KOT — pick whichever printer the OS already has set up (WiFi, Bluetooth, or a print-service app like Epson iPrint / Mopria).
            </p>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4 mt-7 mb-1">Device</p>
          <Row label="Terminal name" hint="Printed on the KOT header so the kitchen knows which till fired the ticket.">
            <input className={inputCls} value={settings.terminalName} onChange={(e) => set('terminalName', e.target.value)} placeholder="e.g. Terminal A" />
          </Row>
          <Row label="Sounds" hint="The kitchen-ready chime and other alert cues.">
            <Toggle on={settings.soundEnabled} onChange={(v) => set('soundEnabled', v)} />
          </Row>
          <Row label="Volume">
            {/* A slider with no readout is a control you can only set by ear —
                on a terminal whose sound may currently be muted. */}
            <input type="range" min={0} max={100} step={5} value={settings.soundVolume} disabled={!settings.soundEnabled}
              aria-label="Sound volume"
              onChange={(e) => set('soundVolume', Number(e.target.value))} className="w-[120px] accent-brand disabled:opacity-40" />
            <span className={`w-9 text-right tabular-nums ${settings.soundEnabled ? 'text-ink-2' : 'text-ink-4'}`}>
              {settings.soundVolume}%
            </span>
          </Row>
          <Row label="Keep screen awake" hint="Stops the terminal dimming during a shift.">
            <Toggle on={settings.keepAwake} onChange={(v) => set('keepAwake', v)} />
          </Row>
        </>
      )}

      {section === 'sync' && (
        <SyncPanel summary={summary} diag={diag} online={online} />
      )}

      {section === 'managed' && <ManagedPanel managed={managed} isManager={isManager} />}

        {!loaded && <p className="text-[12px] text-ink-4 mt-4">Loading terminal settings…</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pos-bg-base,#F6F7F9)] flex flex-col">
      {/* Header. The title is the title; Back is a control beside it, not a
          second label competing with it — it used to render "← Back" and
          "Settings" at the same size and weight, so neither read as the page's
          name. */}
      <div className="h-16 shrink-0 bg-surface border-b border-line flex items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => (detailOpen ? setMobileOpen(false) : router.back())}
          aria-label={detailOpen ? 'Back to settings' : 'Leave settings'}
          className="grid place-items-center w-10 h-10 -ml-1 rounded-xl text-ink-2 hover:text-ink hover:bg-sunken transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[17px] font-semibold text-ink">
          {detailOpen ? NAV.find((n) => n.id === section)?.label ?? 'Settings' : 'Settings'}
        </h1>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <nav className={`w-full sm:w-[260px] shrink-0 bg-white sm:border-r border-line overflow-y-auto py-2 ${mobileOpen ? 'hidden sm:block' : 'block'}`}>
          {NAV.map(({ id, label, hint, Icon }) => {
            // On a phone the list IS the page until you tap into a section, so
            // nothing is selected yet — highlighting a row there claims you are
            // already inside it. On desktop both panes are on screen, so the
            // highlight isthe whole time.
            const active = section === id && (!isNarrow || mobileOpen);
            const attention = id === 'sync' ? (summary?.poisoned ?? 0) + (summary?.abandoned ?? 0) : 0;
            return (
              <button
                key={id}
                onClick={() => openSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-sunken'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{label}</span>
                  <span className={`block text-[11px] truncate ${active ? 'text-brand/70' : 'text-ink-4'}`}>{hint}</span>
                </span>
                {attention > 0 && (
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shrink-0">{attention}</span>
                )}
                {id === 'managed' && <Lock size={12} className="text-ink-4 shrink-0" />}
                <ChevronRight size={14} className="sm:hidden text-ink-4 shrink-0" />
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className={`flex-1 min-w-0 ${mobileOpen ? 'block' : 'hidden sm:block'}`}>{panel}</div>
      </div>
    </div>
  );
}

// ─── Sync & Data (spec Part 9 — every value read live from the event store) ──
//
// One page, not three. "Sync Status", "Offline Queue" and "Storage" were
// separate nav entries answering one question — is this terminal's work safe
// and is it reaching the server — so the answer was split across three taps
// with no single place that told you.

function SyncPanel({ summary, diag, online }: { summary: UnsyncedSummary | null; diag: any; online: boolean }) {
  const s = summary;
  const attention: any[] = diag?.attention ?? [];
  const totalEvents = diag ? Object.values(diag.byState).reduce((a: number, b: any) => a + b, 0) : 0;
  const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (navigator.storage?.estimate) navigator.storage.estimate().then(setEst).catch(() => {});
  }, []);

  const mb = (n?: number) => (n == null ? '—' : `${(n / 1_048_576).toFixed(1)} MB`);

  // A 1s ticker so the "updated Ns ago" clock actually moves — that, plus the
  // status dot changing colour on its own, is what makes this read as a live
  // readout instead of a settings form that happens to show numbers.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const lastAtMs = diag?.lastProgressAt ? new Date(diag.lastProgressAt).getTime() : null;
  const agoSec = lastAtMs == null ? null : Math.max(0, Math.round((now - lastAtMs) / 1000));
  const agoStr =
    agoSec == null ? 'no activity yet'
      : agoSec < 5 ? 'just now'
        : agoSec < 60 ? `${agoSec}s ago`
          : agoSec < 3600 ? `${Math.round(agoSec / 60)}m ago`
            : `${Math.round(agoSec / 3600)}h ago`;

  const needsManager = (s?.poisoned ?? 0) + (s?.abandoned ?? 0);
  const interrupted = !!(s?.stalled || s?.circuitOpen);
  const inFlight = s?.count ?? 0;
  const headline =
    needsManager > 0
      ? { t: `${needsManager} change${needsManager === 1 ? '' : 's'} need a manager`, c: 'text-rose-700', d: 'bg-rose-500' }
      : interrupted
        ? { t: 'Sync interrupted — retrying', c: 'text-rose-700', d: 'bg-rose-500 pulse-red' }
        : inFlight > 0
          ? { t: `Syncing ${inFlight} change${inFlight === 1 ? '' : 's'}…`, c: 'text-amber-700', d: 'bg-amber-500' }
          : { t: 'All changes saved', c: 'text-emerald-700', d: 'bg-emerald-500' };
  const nothingToDo = inFlight === 0 && needsManager === 0 && !interrupted;

  const exportDiag = async () => {
    setBusy(true);
    try {
      const d = await getSyncDiagnostics();
      const sum = await getUnsyncedSummary();
      const sess = getPosSession();
      const blob = new Blob(
        [JSON.stringify({ at: new Date().toISOString(), session: { role: sess?.role, branchId: sess?.branchId }, summary: sum, diag: d }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = linkRef.current!;
      a.href = url;
      a.download = `pos-diagnostics-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="text-[15px] font-bold text-ink mb-1">Sync &amp; Data</h2>
      <p className="text-[12px] text-ink-3 leading-relaxed mb-4">
        Everything you do is saved on this device first, then sent to the server.
        Every figure below is read live from this terminal&apos;s event log.
      </p>

      {/* Live status — the dot colour and the "updated" clock both move on
          their own, so this reads as a running readout, not a static form. */}
      <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-4 py-3 mb-5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${headline.d}`} />
        <span className={`text-[14px] font-bold ${headline.c}`}>{headline.t}</span>
        <span className="ml-auto text-[11px] text-ink-4 tabular-nums shrink-0">updated {agoStr}</span>
      </div>

      {s?.circuitOpen && (
        <p className="text-[12px] text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4 leading-relaxed">
          Can&apos;t reach the server right now. Nothing is lost — changes are held
          here and send on their own once it&apos;s back.
        </p>
      )}

      <Row label="Waiting to send">
        <span className={`text-[13px] font-semibold tabular-nums ${(s?.count ?? 0) > 0 ? 'text-amber-600' : 'text-ink-2'}`}>{s?.count ?? '…'}</span>
      </Row>
      <Row label="Sent today">
        <span className="text-[13px] text-ink-2 tabular-nums">{s?.confirmedToday ?? '…'}</span>
      </Row>
      <Row label="Last synced">
        <span className="text-[13px] text-ink-2 tabular-nums">
          {diag?.lastProgressAt ? new Date(diag.lastProgressAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
        </span>
      </Row>

      <button
        onClick={() => { forceSyncNow(); toast.message('Trying now…'); }}
        disabled={nothingToDo}
        className="mt-4 h-10 px-4 rounded-xl bg-brand text-white font-semibold text-[13px] hover:bg-orange-600 transition-colors disabled:bg-sunken disabled:text-ink-4"
      >
        {nothingToDo ? 'Nothing waiting' : 'Sync now'}
      </button>

      {attention.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-5 mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">Rejected payments</p>
            <button
              onClick={async () => {
                for (const a of attention) await discardStuckEvent(a.id);
                toast.success(`Dismissed ${attention.length} — the orders are back on the board`);
              }}
              className="text-[11px] font-semibold text-ink-3 hover:text-ink-2"
            >
              Dismiss all {attention.length}
            </button>
          </div>
          <p className="text-[11px] text-ink-4 mb-2.5 leading-relaxed">
            The server turned these down — the amount charged didn&apos;t match
            the order. They won&apos;t go through by retrying. Dismiss to put the
            order back on the board, then collect payment again.
          </p>
          <div className="space-y-2">
            {attention.map((a) => (
              <RejectedRow key={a.id} a={a} onDone={() => toast.success('Dismissed — the order is back on the board')} />
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4 mt-7 mb-1">Storage</p>
      <Row label="Events held on this device" hint="Kept until the server confirms them.">
        <span className="text-[13px] text-ink-2 tabular-nums">{totalEvents}</span>
      </Row>
      <Row label="Space used">
        <span className="text-[13px] text-ink-2 tabular-nums">{mb(est?.usage)}{est?.quota ? ` of ${mb(est.quota)}` : ''}</span>
      </Row>
      <Row label="App version">
        <span className="text-[13px] text-ink-2">v{APP_VERSION}</span>
      </Row>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={async () => {
            const { snapshotViews } = await import('@/lib/core/views');
            await snapshotViews();
            toast.success('Confirmed history compacted');
          }}
          className="h-10 px-4 rounded-xl bg-white border border-line text-ink-2 font-semibold text-[13px] hover:bg-sunken transition-colors"
        >
          Free Up Space
        </button>
        <button
          onClick={exportDiag}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-white border border-line text-ink-2 font-semibold text-[13px] hover:bg-sunken disabled:opacity-50 transition-colors inline-flex items-center gap-2"
        >
          <Download size={14} /> {busy ? 'Preparing…' : 'Export Diagnostics'}
        </button>
      </div>
      <a ref={linkRef} className="hidden" />
    </>
  );
}

// One rejected payment, in plain language — not `PAYMENT_COLLECTED · <cuid> ·
// 1 attempts`. Resolves the aggregate id to a real order number/total from the
// view store and turns the server's error string into a sentence a manager can
// act on.
function RejectedRow({ a, onDone }: { a: any; onDone: () => void }) {
  const router = useRouter();
  const localId = resolveLocalOrderId(a.aggregateId);
  const order = useViews((s) => s.orders[localId]);
  const orderLabel = order?.orderNumber || order?.tokenNumber || null;

  const m = /less than the order total PKR\s*([\d,]+)/i.exec(a.lastError || '');
  const billed = /total PKR\s*([\d,]+)\s+is less/i.exec(a.lastError || '');
  let reason: string;
  if (billed && m) {
    const paid = Number(billed[1].replace(/,/g, ''));
    const owed = Number(m[1].replace(/,/g, ''));
    reason = paid === 0
      ? `The payment went through as PKR 0 — the order is PKR ${owed.toLocaleString()}.`
      : `Charged PKR ${paid.toLocaleString()}, but the order is PKR ${owed.toLocaleString()}.`;
  } else if (/dependency .* is (poisoned|abandoned)/i.test(a.lastError || '')) {
    reason = 'An earlier change on this order also failed to sync.';
  } else {
    reason = a.lastError || 'The server rejected this payment.';
  }

  const when = a.at ? new Date(a.at) : null;
  const canSettle = !!order && (order.status === 'PENDING' || order.status === 'IN_KITCHEN' || order.status === 'READY' || order.status === 'COMPLETED');

  return (
    <div className="bg-rose-50/70 border border-rose-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-ink">
          {orderLabel ? `Order ${orderLabel}` : 'A payment'}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white text-rose-600 shrink-0">Rejected</span>
      </div>
      <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">{reason}</p>
      {when && (
        <p className="text-[10px] text-ink-4 mt-1 tabular-nums">
          {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-4">
        {canSettle && (
          <button
            onClick={async () => {
              await discardStuckEvent(a.id);
              router.push(`/pos/order?orderId=${order!.serverId || order!.id}&checkout=true`);
            }}
            className="text-[11px] font-bold text-brand hover:underline"
          >
            Settle this order
          </button>
        )}
        <button
          onClick={async () => { await discardStuckEvent(a.id); onDone(); }}
          className="text-[11px] font-semibold text-ink-3 hover:text-ink-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ManagedPanel({ managed, isManager }: { managed: any; isManager: boolean }) {
  const rows: Array<[string, string]> = [
    ['Cash tax', managed.cashTaxEnabled ? `${managed.cashTaxRate}% (${managed.cashTaxLabel ?? 'GST'})` : 'off'],
    ['Card / digital tax', managed.cardTaxEnabled ? `${managed.cardTaxRate}%` : 'off'],
    ['Payment methods', [managed.cashEnabled && 'Cash', managed.cardEnabled && 'Card', managed.jazzcashEnabled && 'JazzCash', managed.easypaisaEnabled && 'EasyPaisa'].filter(Boolean).join(', ') || '—'],
    ['KOT printing', managed.kotEnabled ?? managed.autoKotPrint ? 'on' : 'off'],
    ['Cashier discount limit', `${managed.maxDiscountPercent ?? 0}%`],
    ['Void needs manager approval', managed.voidRequiresManagerApproval ? 'yes' : 'no'],
    ['Order number format', String(managed.orderNumberFormat ?? 'STANDARD')],
    ['Table cleaning time', `${managed.tableCleaningMinutes ?? 5} min`],
    ['Require shift to order', (managed.requireShiftOpen ?? managed.requireShiftOpening ?? true) ? 'yes' : 'no'],
    ['Cash count on close', managed.cashCountRequired ?? true ? 'required' : 'optional'],
    ['Close with unsynced', managed.allowCloseWithUnsynced ?? true ? (managed.closeWithUnsyncedRequiresPin ?? true ? 'allowed (manager PIN)' : 'allowed') : 'blocked'],
    ['Receipt header', managed.receiptHeader || '—'],
    ['Receipt footer', managed.receiptFooter || '—'],
  ];
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Lock size={15} className="text-ink-4" />
        <h2 className="text-[18px] font-semibold text-ink">Managed by your administrator</h2>
      </div>
      <p className="text-[12px] text-ink-3 mb-4">
        These come from the console and are read-only here.
        {isManager && (
          <> {' '}
            <a href={`${(process.env.NEXT_PUBLIC_CONSOLE_URL || '').replace(/\/$/, '')}/dashboard/settings`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand">
              Change in Console <ExternalLink size={11} />
            </a>
          </>
        )}
      </p>
      <div className="bg-sunken border border-line rounded-xl px-4 py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-0">
            <span className="text-[12px] text-ink-3">{k}</span>
            <span className="text-[12px] font-semibold text-ink text-right">{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}
