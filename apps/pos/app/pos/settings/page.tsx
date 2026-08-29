'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Lock, User, MonitorSmartphone,
  RefreshCw, ExternalLink, Download, Wifi, WifiOff,
} from 'lucide-react';
import { getPosSession } from '@/lib/pos-session';
import { useBrandingStore } from '@/lib/branding-store';
import { useTerminalSettings } from '@/lib/terminal-settings';
import {
  getUnsyncedSummary, getSyncDiagnostics, forceSyncNow, kickOutbox, discardStuckEvent,
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
  { id: 'account', label: 'Account', hint: 'You, your PIN, language', Icon: User },
  { id: 'terminal', label: 'This Terminal', hint: 'Printer, sound, display, drawer', Icon: MonitorSmartphone },
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
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-[#FF5722]' : 'bg-slate-200'}`}
    >
      <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

const selectCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#FF5722] min-w-[120px]';
const inputCls = 'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#FF5722] min-w-[140px]';

export default function POSSettingsPage() {
  const router = useRouter();
  const session = getPosSession();
  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';
  const branding = useBrandingStore((s) => s.branding);
  const managed = { ...(branding.pos ?? {}), ...branding }; // pos sub-object + flat fallbacks

  const { settings, loaded, load, set } = useTerminalSettings();
  useEffect(() => { void load(); }, [load]);

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

  const panel = (
    <div className="p-5 sm:p-6 overflow-y-auto h-full">
      {section === 'account' && (
        <>
          <h2 className="text-[15px] font-bold text-slate-900 mb-3">Account</h2>
          <Row label="Name">{session?.name ?? '—'}</Row>
          <Row label="Role">{session?.role ?? '—'}</Row>
          <Row label="Branch">{session?.branchName ?? session?.branchId ?? '—'}</Row>
          <Row label="Session expires" hint="This terminal signs you out automatically after this.">
            <span className="text-[13px] text-slate-600 tabular-nums">
              {session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : '—'}
            </span>
          </Row>
          <Row label="PIN" hint="Your PIN unlocks this terminal. Only a branch manager can reset it, from the console.">
            <span className="text-[13px] text-slate-400">Set by your manager</span>
          </Row>
        </>
      )}

      {section === 'terminal' && (
        <>
          <h2 className="text-[15px] font-bold text-slate-900 mb-1">This Terminal</h2>
          <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
            Stored on this device only — never synced. A terminal with a thermal printer
            attached and one without can&apos;t share these.
          </p>

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Printing</p>
          <Row label="Print mode" hint="PDF downloads a receipt; Printer sends ESC/POS to a connected device.">
            <select className={selectCls} value={settings.printMode} onChange={(e) => set('printMode', e.target.value as any)}>
              <option value="PDF">PDF</option>
              <option value="PRINTER">Printer</option>
            </select>
          </Row>
          <Row label="Paper width">
            <select className={selectCls} value={settings.paperWidth} onChange={(e) => set('paperWidth', e.target.value as any)}>
              <option value="58mm">58 mm</option>
              <option value="80mm">80 mm</option>
            </select>
          </Row>

          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-1">Device</p>
          <Row label="Terminal name" hint="Printed on the KOT header so the kitchen knows which till fired the ticket.">
            <input className={inputCls} value={settings.terminalName} onChange={(e) => set('terminalName', e.target.value)} placeholder="e.g. Terminal A" />
          </Row>
          <Row label="Sounds" hint="The kitchen-ready chime and other alert cues.">
            <Toggle on={settings.soundEnabled} onChange={(v) => set('soundEnabled', v)} />
          </Row>
          <Row label="Volume">
            <input type="range" min={0} max={100} value={settings.soundVolume} disabled={!settings.soundEnabled}
              onChange={(e) => set('soundVolume', Number(e.target.value))} className="w-[140px] accent-[#FF5722] disabled:opacity-40" />
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

      {!loaded && <p className="text-[12px] text-slate-400 mt-4">Loading terminal settings…</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pos-bg-base,#F6F7F9)] flex flex-col">
      {/* Header */}
      <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-4">
        <button
          onClick={() => (detailOpen ? setMobileOpen(false) : router.back())}
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> {detailOpen ? 'Settings' : 'Back'}
        </button>
        {!detailOpen && <span className="text-[13px] font-semibold text-slate-900">Settings</span>}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <nav className={`w-full sm:w-[260px] shrink-0 bg-white sm:border-r border-slate-200 overflow-y-auto py-2 ${mobileOpen ? 'hidden sm:block' : 'block'}`}>
          {NAV.map(({ id, label, hint, Icon }) => {
            const active = section === id;
            const attention = id === 'sync' ? (summary?.poisoned ?? 0) + (summary?.abandoned ?? 0) : 0;
            return (
              <button
                key={id}
                onClick={() => openSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-orange-50 text-[#FF5722]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">{label}</span>
                  <span className={`block text-[11px] truncate ${active ? 'text-[#FF5722]/70' : 'text-slate-400'}`}>{hint}</span>
                </span>
                {attention > 0 && (
                  <span className="text-[10px] font-bold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shrink-0">{attention}</span>
                )}
                {id === 'managed' && <Lock size={12} className="text-slate-300 shrink-0" />}
                <ChevronRight size={14} className="sm:hidden text-slate-300 shrink-0" />
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
      <h2 className="text-[15px] font-bold text-slate-900 mb-1">Sync &amp; Data</h2>
      <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
        Everything you do is saved on this device first, then sent to the server.
        Every figure below is read live from this terminal&apos;s event log.
      </p>

      {/* Live status — the dot colour and the "updated" clock both move on
          their own, so this reads as a running readout, not a static form. */}
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 mb-5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${headline.d}`} />
        <span className={`text-[14px] font-bold ${headline.c}`}>{headline.t}</span>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums shrink-0">updated {agoStr}</span>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Connection</p>
      <Row label="Server">
        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${online ? 'text-emerald-600' : 'text-rose-600'}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'Online' : 'Offline'}{s?.avgRttMs != null ? ` · ${s.avgRttMs} ms` : ''}
        </span>
      </Row>
      <Row label="Engine" hint={s?.circuitOpen ? 'Backing off after repeated failures — probing every 15s.' : undefined}>
        <span className="text-[13px] text-slate-600">
          {s?.circuitOpen ? 'Probing' : diag?.batchEndpointAvailable ? 'Batch' : 'REST fallback'}
          {s?.stalled ? ' · stalled' : ''}
        </span>
      </Row>
      <Row label="Last sync">
        <span className="text-[13px] text-slate-600 tabular-nums">
          {diag?.lastProgressAt ? new Date(diag.lastProgressAt).toLocaleTimeString() : '—'}
        </span>
      </Row>

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-1">Queue</p>
      <Row label="Waiting to send">
        <span className={`text-[13px] font-semibold tabular-nums ${(s?.count ?? 0) > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{s?.count ?? '…'}</span>
      </Row>
      <Row label="Sent in the last 24h">
        <span className="text-[13px] text-slate-600 tabular-nums">{s?.confirmedToday ?? '…'}</span>
      </Row>
      <Row label="Needs a manager" hint={attention.length > 0 ? 'The server rejected these — they are listed below.' : undefined}>
        <span className={`text-[13px] font-semibold tabular-nums ${attention.length > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
          {(s?.poisoned ?? 0) + (s?.abandoned ?? 0)}
        </span>
      </Row>

      <button
        onClick={() => { forceSyncNow(); toast.message('Sync kicked'); }}
        disabled={nothingToDo}
        className="mt-4 h-10 px-4 rounded-xl bg-[#FF5722] text-white font-semibold text-[13px] hover:bg-orange-600 transition-colors disabled:bg-slate-100 disabled:text-slate-400"
      >
        {nothingToDo ? 'Nothing waiting to sync' : 'Sync Now'}
      </button>

      {attention.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">Rejected</p>
          <div className="space-y-2">
            {attention.map((a) => (
              <div key={a.id} className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-slate-900">{a.type}</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white text-rose-600">{a.state}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {a.aggregateId} · {a.attempts} attempts{a.at ? ` · ${new Date(a.at).toLocaleString()}` : ''}
                </p>
                {a.lastError && <p className="text-[11px] text-rose-700 mt-0.5">{a.lastError}</p>}
                <div className="mt-2 flex items-center gap-4">
                  <button
                    onClick={() => { kickOutbox('immediate'); toast.message('Retrying…'); }}
                    className="text-[11px] font-semibold text-[#FF5722] flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Retry
                  </button>
                  <button
                    onClick={async () => { await discardStuckEvent(a.id); toast.success('Dismissed — re-collect the payment to settle the order'); }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-1">Storage</p>
      <Row label="Events held on this device" hint="Kept until the server confirms them.">
        <span className="text-[13px] text-slate-600 tabular-nums">{totalEvents}</span>
      </Row>
      <Row label="Space used">
        <span className="text-[13px] text-slate-600 tabular-nums">{mb(est?.usage)}{est?.quota ? ` of ${mb(est.quota)}` : ''}</span>
      </Row>
      <Row label="App version">
        <span className="text-[13px] text-slate-600">v{APP_VERSION}</span>
      </Row>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={async () => {
            const { snapshotViews } = await import('@/lib/core/views');
            await snapshotViews();
            toast.success('Confirmed history compacted');
          }}
          className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-[13px] hover:bg-slate-50 transition-colors"
        >
          Free Up Space
        </button>
        <button
          onClick={exportDiag}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-[13px] hover:bg-slate-50 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
        >
          <Download size={14} /> {busy ? 'Preparing…' : 'Export Diagnostics'}
        </button>
      </div>
      <a ref={linkRef} className="hidden" />
    </>
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
        <Lock size={15} className="text-slate-400" />
        <h2 className="text-[15px] font-bold text-slate-900">Managed by your administrator</h2>
      </div>
      <p className="text-[12px] text-slate-500 mb-4">
        These come from the console and are read-only here.
        {isManager && (
          <> {' '}
            <a href={`${(process.env.NEXT_PUBLIC_CONSOLE_URL || '').replace(/\/$/, '')}/dashboard/settings`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#FF5722]">
              Change in Console <ExternalLink size={11} />
            </a>
          </>
        )}
      </p>
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
            <span className="text-[12px] text-slate-500">{k}</span>
            <span className="text-[12px] font-semibold text-slate-800 text-right">{v}</span>
          </div>
        ))}
      </div>
    </>
  );
}
