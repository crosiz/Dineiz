'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Lock, User, KeyRound, Languages, Printer, MonitorSmartphone,
  Volume2, Wallet, RefreshCw, ListChecks, HardDrive, Clock, Coffee, Info, Wrench,
  CheckCircle2, AlertTriangle, ExternalLink, Download, Wifi, WifiOff,
} from 'lucide-react';
import { getPosSession, getPosShift, getToken } from '@/lib/pos-session';
import { useBrandingStore } from '@/lib/branding-store';
import { useTerminalSettings } from '@/lib/terminal-settings';
import {
  getUnsyncedSummary, getSyncDiagnostics, forceSyncNow, kickOutbox,
  type UnsyncedSummary,
} from '@/lib/core/outbox';
import { getDB } from '@/lib/db';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const APP_VERSION = '0.1.0';

type SectionId =
  | 'account' | 'changePin' | 'language'
  | 'printer' | 'display' | 'sound' | 'cashDrawer'
  | 'syncStatus' | 'offlineQueue' | 'storage'
  | 'currentShift' | 'breaks'
  | 'managed'
  | 'version' | 'diagnostics';

const GROUPS: Array<{ title: string; managerOnly?: boolean; items: Array<{ id: SectionId; label: string; Icon: any }> }> = [
  { title: 'My Profile', items: [
    { id: 'account', label: 'Account', Icon: User },
    { id: 'changePin', label: 'Change PIN', Icon: KeyRound },
    { id: 'language', label: 'Language', Icon: Languages },
  ] },
  { title: 'Terminal', items: [
    { id: 'printer', label: 'Printer', Icon: Printer },
    { id: 'display', label: 'Display', Icon: MonitorSmartphone },
    { id: 'sound', label: 'Sound', Icon: Volume2 },
    { id: 'cashDrawer', label: 'Cash Drawer', Icon: Wallet },
  ] },
  { title: 'Sync & Data', items: [
    { id: 'syncStatus', label: 'Sync Status', Icon: RefreshCw },
    { id: 'offlineQueue', label: 'Offline Queue', Icon: ListChecks },
    { id: 'storage', label: 'Storage', Icon: HardDrive },
  ] },
  { title: 'Shift', items: [
    { id: 'currentShift', label: 'Current Shift', Icon: Clock },
    { id: 'breaks', label: 'Breaks', Icon: Coffee },
  ] },
  { title: 'Managed by Console', items: [
    { id: 'managed', label: 'Tax, Payments, Limits…', Icon: Lock },
  ] },
  { title: 'About', items: [
    { id: 'version', label: 'Version', Icon: Info },
    { id: 'diagnostics', label: 'Diagnostics', Icon: Wrench },
  ] },
];

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

// One shell for every settings pane — same heading, optional one-line
// description, same spacing. Keeps the screen coherent as sections are added.
function SettingsSection({ title, description, icon, children }: {
  title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
      </div>
      {description && <p className="text-[12px] text-slate-500 leading-relaxed mt-1 mb-3 max-w-[46ch]">{description}</p>}
      {!description && <div className="mb-3" />}
      {children}
    </section>
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

  // Opens on My Profile by default; deep-linkable via ?section= (the top-bar
  // Settings item and the sync-health dot both point at specific sections).
  const searchParams = useSearchParams();
  const ALL_SECTIONS: SectionId[] = GROUPS.flatMap((g) => g.items.map((i) => i.id));
  const initialSection = (() => {
    const q = searchParams.get('section') as SectionId | null;
    return q && ALL_SECTIONS.includes(q) ? q : 'account';
  })();
  const [section, setSection] = useState<SectionId>(initialSection);
  const [mobileOpen, setMobileOpen] = useState(!!searchParams.get('section')); // mobile: is a detail open

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
    <div className="p-5 sm:p-8 overflow-y-auto h-full max-w-2xl">
      {section === 'account' && (
        <SettingsSection title="Account" description="Who you're signed in as on this terminal.">
          <Row label="Name">{session?.name ?? '—'}</Row>
          <Row label="Role">{session?.role ?? '—'}</Row>
          <Row label="Branch">{session?.branchName ?? session?.branchId ?? '—'}</Row>
          <Row label="Session expires" hint="This terminal signs you out automatically after this.">
            <span className="text-[13px] text-slate-600 tabular-nums">
              {session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : '—'}
            </span>
          </Row>
        </SettingsSection>
      )}

      {section === 'changePin' && (
        <SettingsSection title="Change PIN" description="Your PIN unlocks this terminal. Self-service PIN change lands with the manager overlay — for now a branch manager resets it from the console.">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); toast.message('Ask your branch manager to reset your PIN in the console.'); }}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FF5722]"
          >
            Request a reset <ChevronRight size={14} />
          </a>
        </SettingsSection>
      )}

      {section === 'language' && (
        <SettingsSection title="Language" description="Applies to this device only.">
          <Row label="Terminal language">
            <select className={selectCls} value={settings.language} onChange={(e) => set('language', e.target.value)}>
              <option value="en">English</option>
              <option value="ur">اردو (Urdu)</option>
            </select>
          </Row>
        </SettingsSection>
      )}

      {section === 'printer' && (
        <SettingsSection title="Printer" description="Set per device — a terminal with a thermal printer and one without don't share this.">
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
          <Row label="Printer name" hint="Optional label for the connected printer.">
            <input className={inputCls} value={settings.printerName} onChange={(e) => set('printerName', e.target.value)} placeholder="e.g. Front counter" />
          </Row>
        </SettingsSection>
      )}

      {section === 'display' && (
        <SettingsSection title="Display">
          <Row label="Keep screen awake" hint="Stops the terminal dimming during a shift.">
            <Toggle on={settings.keepAwake} onChange={(v) => set('keepAwake', v)} />
          </Row>
          <Row label="Terminal display name" hint="Shown on tickets and the KOT header.">
            <input className={inputCls} value={settings.terminalName} onChange={(e) => set('terminalName', e.target.value)} placeholder="e.g. Terminal A" />
          </Row>
        </SettingsSection>
      )}

      {section === 'sound' && (
        <SettingsSection title="Sound" description="The kitchen-ready chime and other alert cues on this terminal.">
          <Row label="Sounds"><Toggle on={settings.soundEnabled} onChange={(v) => set('soundEnabled', v)} /></Row>
          <Row label="Volume">
            <input type="range" min={0} max={100} value={settings.soundVolume} disabled={!settings.soundEnabled}
              onChange={(e) => set('soundVolume', Number(e.target.value))} className="w-[140px] accent-[#FF5722] disabled:opacity-40" />
          </Row>
        </SettingsSection>
      )}

      {section === 'cashDrawer' && (
        <SettingsSection title="Cash Drawer" description="Where the drawer-kick pulse is sent when a cash payment completes.">
          <Row label="Drawer port" hint="Serial/USB port, e.g. COM3.">
            <input className={inputCls} value={settings.cashDrawerPort} onChange={(e) => set('cashDrawerPort', e.target.value)} placeholder="e.g. COM3" />
          </Row>
        </SettingsSection>
      )}

      {section === 'syncStatus' && <SyncStatusPanel summary={summary} diag={diag} online={online} onReview={() => openSection('offlineQueue')} />}

      {section === 'offlineQueue' && <OfflineQueuePanel diag={diag} />}

      {section === 'storage' && <StoragePanel diag={diag} />}

      {section === 'currentShift' && <CurrentShiftPanel />}

      {section === 'breaks' && <BreaksPanel />}

      {section === 'managed' && <ManagedPanel managed={managed} isManager={isManager} />}

      {section === 'version' && (
        <SettingsSection title="About" description="Build and sync-engine details for this terminal.">
          <Row label="Dineiz POS">v{APP_VERSION}</Row>
          <Row label="Sync engine">{diag?.batchEndpointAvailable ? 'Batch ingestion' : 'REST fallback'}</Row>
          <Row label="Local event log">{diag ? Object.entries(diag.byState).map(([k, v]) => `${k}:${v}`).join('  ') || 'no events yet' : '…'}</Row>
        </SettingsSection>
      )}

      {section === 'diagnostics' && <DiagnosticsPanel />}

      {!loaded && <p className="text-[12px] text-slate-400 mt-4">Loading terminal settings…</p>}
    </div>
  );

  const attention = (summary?.poisoned ?? 0) + (summary?.abandoned ?? 0);

  return (
    <div className="fixed inset-0 z-[90] bg-[var(--pos-bg-base,#F6F7F9)] flex flex-col">
      {/* Header */}
      <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4">
        <button
          onClick={() => (mobileOpen ? setMobileOpen(false) : router.back())}
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> {mobileOpen ? 'Settings' : 'Back'}
        </button>
        <div className="text-right leading-tight">
          <p className="text-[13px] font-semibold text-slate-800">{settings.terminalName || 'This terminal'}</p>
          <p className="text-[11px] text-slate-400">{session?.branchName ?? session?.branchId ?? ''}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Sidebar */}
        <nav className={`w-full sm:w-[264px] shrink-0 bg-white sm:border-r border-slate-200 overflow-y-auto py-2 ${mobileOpen ? 'hidden sm:block' : 'block'}`}>
          {GROUPS.filter((g) => !g.managerOnly || isManager).map((g) => (
            <div key={g.title} className="mb-1">
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
              {g.items.map(({ id, label, Icon }) => {
                const isActive = section === id;
                return (
                  <button
                    key={id}
                    onClick={() => openSection(id)}
                    className={`w-full flex items-center gap-2.5 pl-4 pr-3 py-2.5 text-[13px] font-medium transition-colors border-l-2 ${
                      isActive
                        ? 'border-[#FF5722] bg-orange-50 text-[#FF5722]'
                        : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="flex-1 text-left truncate">{label}</span>
                    {id === 'syncStatus' && attention > 0 && (
                      <span className="text-[10px] font-bold text-white bg-rose-500 rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{attention}</span>
                    )}
                    {g.title === 'Managed by Console' && <Lock size={12} className="text-slate-300" />}
                    <ChevronRight size={14} className="sm:hidden text-slate-300" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className={`flex-1 min-w-0 ${mobileOpen ? 'block' : 'hidden sm:block'}`}>{panel}</div>
      </div>
    </div>
  );
}

// ─── Sync Status panel (spec Part 9 — every value read live) ──────────────

function syncState(s: UnsyncedSummary | null, online: boolean) {
  const attention = (s?.poisoned ?? 0) + (s?.abandoned ?? 0);
  if (attention > 0) return {
    tone: 'rose' as const, dot: 'bg-rose-500',
    title: `${attention} change${attention === 1 ? '' : 's'} need review`,
    sub: 'The server rejected these. A manager resolves them in the admin panel.',
  };
  if (s?.stalled || s?.circuitOpen) return {
    tone: 'rose' as const, dot: 'bg-rose-500 pulse-red',
    title: s?.circuitOpen ? 'Can’t reach the server' : 'Sync has stalled',
    sub: s?.circuitOpen ? 'Retrying on a timer — your work is saved on this device.' : 'The engine will restart itself; your work is safe.',
  };
  if (!online) return {
    tone: 'amber' as const, dot: 'bg-amber-500 pulse-amber',
    title: 'Working offline',
    sub: `${s?.count ?? 0} change${(s?.count ?? 0) === 1 ? '' : 's'} queued — they’ll sync when you’re back online.`,
  };
  if ((s?.count ?? 0) > 0) return {
    tone: 'amber' as const, dot: 'bg-amber-500 pulse-amber',
    title: `Syncing ${s!.count} change${s!.count === 1 ? '' : 's'}`,
    sub: 'Shipping to the server now.',
  };
  return {
    tone: 'emerald' as const, dot: 'bg-emerald-500',
    title: 'Everything’s synced',
    sub: `All ${s?.confirmedToday ?? 0} change${(s?.confirmedToday ?? 0) === 1 ? '' : 's'} from the last 24h are saved on the server.`,
  };
}

const TONE_BG = { emerald: 'bg-emerald-50 border-emerald-200', amber: 'bg-amber-50 border-amber-200', rose: 'bg-rose-50 border-rose-200' } as const;

function SyncStatusPanel({ summary, diag, online, onReview }: { summary: UnsyncedSummary | null; diag: any; online: boolean; onReview: () => void }) {
  const s = summary;
  const st = syncState(s, online);
  const attention = (s?.poisoned ?? 0) + (s?.abandoned ?? 0);
  const tiles: Array<[string, React.ReactNode]> = [
    ['Connection', online ? (s?.avgRttMs != null ? `${s.avgRttMs} ms` : 'Online') : 'Offline'],
    ['Engine', s?.circuitOpen ? 'probing' : diag?.batchEndpointAvailable ? 'batch' : 'REST'],
    ['Last sync', diag?.lastProgressAt ? new Date(diag.lastProgressAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'],
  ];

  return (
    <SettingsSection title="Sync Status" description="Live view of whether this terminal's changes are reaching the server. Every number here is read from the local event log.">
      {/* Status hero */}
      <div className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 ${TONE_BG[st.tone]}`}>
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${st.dot}`} />
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-slate-900">{st.title}</p>
          <p className="text-[12px] text-slate-600 leading-relaxed mt-0.5">{st.sub}</p>
        </div>
      </div>

      {/* Live tiles */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p>
            <p className="text-[13px] font-semibold text-slate-900 tabular-nums mt-0.5 truncate">{v}</p>
          </div>
        ))}
      </div>

      {/* Queue breakdown */}
      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
        {([
          ['Confirmed (24h)', s?.confirmedToday ?? '…', ''],
          ['Pending', s?.count ?? '…', (s?.count ?? 0) > 0 ? 'text-amber-600' : ''],
          ['Superseded', s?.superseded ?? '…', ''],
          ['Needs attention', attention, attention > 0 ? 'text-rose-600' : ''],
        ] as Array<[string, React.ReactNode, string]>).map(([k, v, cls]) => (
          <div key={k} className="flex justify-between items-center text-[13px] py-2 border-b border-slate-100 last:border-0">
            <span className="text-slate-600">{k}</span>
            <span className={`font-semibold tabular-nums ${cls}`}>{v}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-4">
        <button onClick={() => { forceSyncNow(); toast.message('Sync kicked'); }}
          className="h-10 rounded-xl bg-[#FF5722] text-white font-semibold text-[13px] hover:bg-orange-600 transition-colors">
          Force Sync Now
        </button>
        {attention > 0 && (
          <button onClick={onReview}
            className="h-10 rounded-xl bg-white border border-rose-200 text-rose-600 font-semibold text-[13px] hover:bg-rose-50 transition-colors">
            Review {attention} item{attention === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </SettingsSection>
  );
}

function OfflineQueuePanel({ diag }: { diag: any }) {
  const attention: any[] = diag?.attention ?? [];
  return (
    <SettingsSection title="Offline Queue" description="Changes the server rejected or that outlived their retry window. A manager resolves these in the admin panel.">
      {attention.length === 0 ? (
        <div className="flex items-center gap-2 text-[13px] text-emerald-600 font-medium">
          <CheckCircle2 size={16} /> Nothing needs attention.
        </div>
      ) : (
        <div className="space-y-2">
          {attention.map((a) => (
            <div key={a.id} className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-900">{a.type}</span>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white text-rose-600">{a.state}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{a.aggregateId} · {a.attempts} attempts · {a.at ? new Date(a.at).toLocaleString() : ''}</p>
              {a.lastError && <p className="text-[11px] text-rose-700 mt-0.5">{a.lastError}</p>}
              <button onClick={() => { kickOutbox('immediate'); toast.message('Retrying…'); }}
                className="mt-2 text-[11px] font-semibold text-[#FF5722] flex items-center gap-1">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

function StoragePanel({ diag }: { diag: any }) {
  const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null);
  useEffect(() => {
    if (navigator.storage?.estimate) navigator.storage.estimate().then((e) => setEst(e)).catch(() => {});
  }, []);
  const mb = (n?: number) => (n == null ? '—' : `${(n / 1_048_576).toFixed(1)} MB`);
  const total = diag ? Object.values(diag.byState).reduce((a: number, b: any) => a + b, 0) : 0;
  return (
    <SettingsSection title="Storage" description="This terminal keeps every change in an on-device log until the server confirms it. Compacting drops only the already-confirmed history.">
      <Row label="Events in local log">{total}</Row>
      <Row label="This origin uses">{mb(est?.usage)}{est?.quota ? ` of ${mb(est.quota)}` : ''}</Row>
      <button
        onClick={async () => {
          const { snapshotViews } = await import('@/lib/core/views');
          await snapshotViews();
          toast.success('Confirmed history compacted');
        }}
        className="mt-4 h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-[13px] hover:bg-slate-50 transition-colors"
      >
        Clear Confirmed History
      </button>
    </SettingsSection>
  );
}

function CurrentShiftPanel() {
  const shift = getPosShift();
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    if (!shift?.shiftId) return;
    fetch(`${API_URL}/api/shifts/${shift.shiftId}/summary`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then(setSummary).catch(() => {});
  }, [shift?.shiftId]);
  if (!shift?.shiftId) return (
    <SettingsSection title="Current Shift">
      <p className="text-[13px] text-slate-500">No shift open on this terminal.</p>
    </SettingsSection>
  );
  return (
    <SettingsSection title="Current Shift" description="A read-only snapshot — close the shift from the profile menu.">
      <Row label="Opened">{shift.openedAt ? new Date(shift.openedAt).toLocaleString() : '—'}</Row>
      <Row label="Opening float">PKR {Math.round(shift.openingFloat ?? 0).toLocaleString()}</Row>
      <Row label="Orders">{summary?.totalOrders ?? '…'}</Row>
      <Row label="Net sales">PKR {Math.round(summary?.totalSales ?? 0).toLocaleString()}</Row>
      <Row label="Expected in drawer">PKR {Math.round(summary?.expectedCash ?? 0).toLocaleString()}</Row>
    </SettingsSection>
  );
}

function BreaksPanel() {
  const shift = getPosShift();
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    if (!shift?.shiftId) return;
    fetch(`${API_URL}/api/shifts/${shift.shiftId}/summary`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null)).then(setSummary).catch(() => {});
  }, [shift?.shiftId]);
  return (
    <SettingsSection title="Breaks" description="Break time on the current shift. Start a break from the profile menu.">
      <Row label="Breaks taken">{summary?.breakCount ?? 0}</Row>
      <Row label="Total break time">{summary?.totalBreakMinutes ?? 0} min</Row>
      <Row label="On break now">{summary?.onBreak ? 'Yes' : 'No'}</Row>
    </SettingsSection>
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
    <SettingsSection title="Managed by your administrator" icon={<Lock size={15} className="text-slate-400" />}
      description="Tax, payment methods, discount limits and order rules come from the console and are read-only here.">
      {isManager && (
        <a href={`${(process.env.NEXT_PUBLIC_CONSOLE_URL || '').replace(/\/$/, '')}/dashboard/settings`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#FF5722] mb-3">
          Change in Console <ExternalLink size={11} />
        </a>
      )}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
            <span className="text-[12px] text-slate-500">{k}</span>
            <span className="text-[12px] font-semibold text-slate-800 text-right">{v}</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function DiagnosticsPanel() {
  const [busy, setBusy] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const exportDiag = async () => {
    setBusy(true);
    try {
      const diag = await getSyncDiagnostics();
      const summary = await getUnsyncedSummary();
      const session = getPosSession();
      const blob = new Blob([JSON.stringify({ at: new Date().toISOString(), session: { role: session?.role, branchId: session?.branchId }, summary, diag }, null, 2)], { type: 'application/json' });
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
    <SettingsSection title="Diagnostics" description="A JSON snapshot of this terminal's sync state — hand it to support if something's stuck.">
      <button onClick={exportDiag} disabled={busy}
        className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-[13px] hover:bg-slate-50 disabled:opacity-50 transition-colors inline-flex items-center gap-2">
        <Download size={14} /> {busy ? 'Preparing…' : 'Export Diagnostics'}
      </button>
      <a ref={linkRef} className="hidden" />
    </SettingsSection>
  );
}
