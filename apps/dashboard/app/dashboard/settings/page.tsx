"use client";
import { formatPKR, formatVariance, formatPercentage, formatAxisPKR } from '@/lib/formatters';

import { useEffect, useState, useRef } from "react";
import { useUser } from "@/contexts/user-context";
import { apiFetch, API_URL } from "@/lib/api";
import { toast } from "sonner";
import { Check, ChevronRight, Upload, AlertTriangle } from "lucide-react";

// ─── Utilities ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptSettings {
  taxDisplay: "inclusive" | "separate";
  // Dual-tax (FBR compliant)
  cashTaxEnabled: boolean;
  cashTaxRate: number;
  cashTaxLabel: string;
  cardTaxEnabled: boolean;
  cardTaxRate: number;
  cardTaxLabel: string;
  showDualTaxOnReceipt: boolean;
  cashTaxNote: string;
  cardTaxNote: string;
  taxRoundingMethod: "ROUND" | "FLOOR" | "CEIL";
  paperSize: "80mm" | "A4";
  headerMessage: string;
  footerMessage: string;
  showPoweredBy: boolean;
  showLogo: boolean;
  showCashierName: boolean;
  showTableNumber: boolean;
  showTaxBreakdown: boolean;
  cashShowTendered: boolean;
  cashShowChange: boolean;
  cardShowMethod: boolean;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  fbrEnabled: boolean;
  fbrNtn: string;
  fbrPosId: string;
  downloadPdfReceipt: boolean;
  layout: string;
}

interface PosConfig {
  autoPrintKOT: boolean;
  autoPrintReceipt: boolean;
  requireShiftOpening: boolean;
  blockOutOfStock: boolean;
  offlineMode: boolean;
}

interface KitchenSettings {
  useKDS: boolean;
  autoPrintKOT: boolean;
}

// ─── Primitive Design Components ─────────────────────────────────────────────

/** Thin horizontal rule between settings rows */
const Divider = () => <div className="h-px bg-[#F1F5F9]" />;

/** Label + hint for a form group */
function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[13.5px] font-medium text-[#0F172A] leading-5">{label}</p>
      {hint && <p className="text-[12px] text-[#94A3B8] mt-0.5 leading-4">{hint}</p>}
    </div>
  );
}

/** Full-width text input */
function Input({
  label, hint, value, onChange, type = "text", placeholder = "", required = false,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11.5px] font-semibold text-[#64748B] uppercase tracking-wide">{label}</label>
      <input
        required={required}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 bg-white border border-[#E2E8F0] rounded-lg px-3 text-[13.5px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all"
      />
      {hint && <p className="text-[11.5px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

/** Textarea input */
function Textarea({
  label, hint, value, onChange, placeholder = "", rows = 2,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11.5px] font-semibold text-[#64748B] uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13.5px] text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all resize-none"
      />
      {hint && <p className="text-[11.5px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

/** Native select — includes a visible dropdown arrow */
function Select({
  label, hint, value, onChange, options,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11.5px] font-semibold text-[#64748B] uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full h-9 bg-white border border-[#E2E8F0] rounded-lg pl-3 pr-8 text-[13.5px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all appearance-none cursor-pointer"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && <p className="text-[11.5px] text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

/** Setting row — label/hint on left, control on right. Auto-centers if no hint. */
function SettingRow({
  label, hint, checked, onChange, children,
}: {
  label: string; hint?: string; checked?: boolean; onChange?: (v: boolean) => void; children?: React.ReactNode;
}) {
  const align = hint ? "items-start" : "items-center";
  return (
    <div className={`flex ${align} justify-between gap-6 py-4 px-6`}>
      <FieldLabel label={label} hint={hint} />
      <div className="shrink-0 pt-0.5">
        {children ?? (
          checked !== undefined && onChange && (
            <Toggle checked={checked} onChange={onChange} />
          )
        )}
      </div>
    </div>
  );
}

/** Pill-style toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 focus:ring-offset-1 ${checked ? "bg-[#6366F1]" : "bg-[#CBD5E1]"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

/** Section wrapper — full-panel card with title header */
function Section({
  title, description, action, children,
}: {
  title: string; description?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0]">
      {/* Card Header */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#F1F5F9]">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          {description && <p className="text-[12.5px] text-[#64748B] mt-0.5 leading-5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Status indicator (Saving / Saved) */
function SaveStatus({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) return (
    <span className="flex items-center gap-1.5 text-[12px] text-[#94A3B8]">
      <div className="w-3 h-3 border border-[#94A3B8] border-t-transparent rounded-full animate-spin" />
      Saving…
    </span>
  );
  if (saved) return (
    <span className="flex items-center gap-1.5 text-[12px] text-[#22C55E] font-medium">
      <Check className="w-3.5 h-3.5" /> Saved
    </span>
  );
  return null;
}

/** Primary action button */
function SaveButton({ onClick, saving, saved, label = "Save changes" }: {
  onClick: () => void; saving: boolean; saved: boolean; label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="h-8 px-4 bg-[#0F172A] text-white text-[12.5px] font-semibold rounded-md hover:bg-[#1E293B] disabled:opacity-50 transition-colors flex items-center gap-1.5"
    >
      {saving ? (
        <><div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
      ) : saved ? (
        <><Check className="w-3.5 h-3.5" /> Saved</>
      ) : label}
    </button>
  );
}

/** Number input (compact, right-aligned value) */
function NumberInput({ value, onChange, min = 0, max = 100, step = 1, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-[68px] h-8 bg-white border border-[#E2E8F0] rounded-lg px-2.5 text-[13px] font-medium text-[#0F172A] text-center focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all"
      />
      {suffix && <span className="text-[12px] font-medium text-[#64748B]">{suffix}</span>}
    </div>
  );
}

// ─── Receipt Preview ──────────────────────────────────────────────────────────

function ThermalReceiptPreview({ settings, branding, generalForm }: { settings: ReceiptSettings; branding: any; generalForm?: any }) {
  const sub = 850;
  const cashTax = Math.round(sub * (settings.cashTaxRate ?? 5) / 100);
  const cardTax = Math.round(sub * (settings.cardTaxRate ?? 17) / 100);
  const cashTotal = sub + cashTax;
  const cardTotal = sub + cardTax;
  const svc = settings.serviceChargeEnabled ? Math.round(sub * settings.serviceChargeRate / 100) : 0;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );

  const layout = settings.layout || 'CLASSIC';
  const Separator = () => {
    if (layout === 'MODERN') return <div className="border-t-[2px] border-solid border-gray-800 my-1.5" />;
    return <div className="border-t border-dashed border-gray-400 my-1" />;
  };

  return (
    <div
      className="w-[220px] text-[10px] text-gray-800 bg-white"
      style={{ fontFamily: "'Courier New', Courier, monospace", lineHeight: 1.6 }}
    >
      {/* Jagged top */}
      <div className="h-3 w-full" style={{
        background: "repeating-linear-gradient(90deg, #f1f5f9 0px, #f1f5f9 6px, white 6px, white 12px)"
      }} />
      <div className="px-4 py-3 space-y-2">
        {/* Header */}
        <div className="text-center space-y-0.5">
          {settings.showLogo && branding?.logoUrl && (
            <img src={branding.logoUrl} className="h-8 w-auto mx-auto object-contain grayscale mb-1" alt="" />
          )}
          <p className="font-bold text-[12px]">{branding?.restaurantName || generalForm?.businessName || "RESTAURANT NAME"}</p>
          {settings.fbrEnabled && settings.fbrNtn && (
            <p className="text-[9px] text-gray-500">NTN: {settings.fbrNtn}</p>
          )}
          {settings.headerMessage && (
            <p className="text-[9px] text-gray-500 italic">{settings.headerMessage}</p>
          )}
        </div>

        <Separator />

        {/* Order meta */}
        {layout === 'MODERN' && <div className="text-center font-bold text-[11px] mb-1">ORDER INFO</div>}
        <div className="space-y-0.5">
          <Row label="Order" value="#1047" />
          <Row label="Date" value="03/08/2026" />
          {settings.showTableNumber && <Row label="Table" value="T-5" />}
          {settings.showCashierName && <Row label="Cashier" value="Ali H." />}
        </div>

        <Separator />

        {/* Items */}
        {layout === 'MODERN' && <div className="text-center font-bold text-[11px] mb-1">ITEMS</div>}
        <div className="space-y-0.5">
          {layout !== 'MINIMAL' && (
            <div className="flex justify-between font-bold text-[9px] uppercase tracking-wide">
              {layout === 'CLASSIC' ? (
                 <><span className="flex-1"># Item</span><span className="w-10 text-right">Price</span><span className="w-10 text-right">Amt</span></>
              ) : (
                 <><span className="flex-1">Qty Item</span><span className="w-10 text-right">Price</span><span className="w-10 text-right">Amt</span></>
              )}
            </div>
          )}
          {[
            { q: 1, n: 'Chicken Karahi', p: 500, a: 500, var: 'Half', adds: ['Extra Spicy (+50)'] },
            { q: 2, n: 'Naan', p: 100, a: 200 },
            { q: 1, n: 'Lassi', p: 150, a: 150 },
          ].map((item, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex justify-between">
                <span className="truncate">{item.q}. {item.n}</span>
                <span className="shrink-0 flex gap-2">
                  {layout !== 'MINIMAL' && <span>{item.p}</span>}
                  <span className="text-right w-6">{item.a}</span>
                </span>
              </div>
              {item.var && <span className="ml-4 text-[9px] text-gray-500">({item.var})</span>}
              {item.adds?.map((a, j) => <span key={j} className="ml-4 text-[9px] text-gray-500">+ {a}</span>)}
            </div>
          ))}
        </div>

        <Separator />

        {/* ── Cash scenario ── */}
        {(settings.cashTaxEnabled || settings.serviceChargeEnabled) && (
          <div className="space-y-0.5">
            <Row label="Subtotal" value={`PKR ${sub.toLocaleString()}`} />
            {settings.cashTaxEnabled && settings.showTaxBreakdown && (
              <Row
                label={`${settings.cashTaxLabel || 'GST (Cash)'} ${settings.cashTaxRate ?? 5}%`}
                value={`PKR ${cashTax.toLocaleString()}`}
              />
            )}
            {settings.serviceChargeEnabled && (
              <Row label={`Service ${settings.serviceChargeRate}%`} value={`PKR ${svc.toLocaleString()}`} />
            )}
            <div className="flex justify-between font-bold pt-0.5 border-t border-gray-400 text-[10.5px]">
              <span>TOTAL (ON CASH)</span>
              <span>PKR {(sub + (settings.cashTaxEnabled ? cashTax : 0) + svc).toLocaleString()}</span>
            </div>
            {settings.cashShowTendered && <Row label="Cash" value="PKR 1,000" />}
            {settings.cashShowChange && <Row label="Change" value={`PKR ${(1000 - sub - (settings.cashTaxEnabled ? cashTax : 0) - svc).toLocaleString()}`} />}
          </div>
        )}

        {/* ── Divider + Card scenario (only if card tax enabled & dual-total toggled) ── */}
        {settings.cardTaxEnabled && settings.showDualTaxOnReceipt && (
          <>
            <Separator />
            <div className="space-y-0.5">
              <Row label="Subtotal" value={`PKR ${sub.toLocaleString()}`} />
              {settings.showTaxBreakdown && (
                <Row
                  label={`${settings.cardTaxLabel || 'GST (Card)'} ${settings.cardTaxRate ?? 17}%`}
                  value={`PKR ${cardTax.toLocaleString()}`}
                />
              )}
              {settings.serviceChargeEnabled && (
                <Row label={`Service ${settings.serviceChargeRate}%`} value={`PKR ${svc.toLocaleString()}`} />
              )}
              <div className="flex justify-between font-bold pt-0.5 border-t border-gray-400 text-[10.5px]">
                <span>TOTAL (ON CARD)</span>
                <span>PKR {(sub + cardTax + svc).toLocaleString()}</span>
              </div>
              {settings.cardShowMethod && <Row label="Paid by" value="CARD ✓" />}
            </div>
          </>
        )}

        {/* Footer */}
        {settings.footerMessage && (
          <>
            <Separator />
            <p className="text-center text-[9px] text-gray-500 italic">{settings.footerMessage}</p>
          </>
        )}
        {settings.showPoweredBy && (
          <>
            <div className="border-t border-dashed border-gray-300" />
            <p className="text-center text-[8px] text-gray-400 tracking-widest uppercase">Powered by Dineiz</p>
          </>
        )}
      </div>
      {/* Jagged bottom */}
      <div className="h-3 w-full" style={{
        background: "repeating-linear-gradient(90deg, #f1f5f9 0px, #f1f5f9 6px, white 6px, white 12px)"
      }} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const NAV = [
  { id: "general", label: "General" },
  { id: "pos", label: "Point of Sale" },
  { id: "receipt", label: "Receipts" },
  { id: "kitchen", label: "Kitchen & KDS" },
  { id: "branding", label: "Branding" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "danger", label: "Danger Zone", danger: true },
];

export default function SettingsPage() {
  const { role } = useUser();
  const isBranchManager = role === "BRANCH_MANAGER";

  const [activeSection, setActiveSection] = useState("general");

  // ── State ─────────────────────────────────────────────────────────────────

  const [generalForm, setGeneralForm] = useState({
    businessName: "", legalName: "", taxRegistration: "",
    businessType: "Fine Dining", city: "", currency: "PKR", timezone: "Asia/Karachi",
  });
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savedGeneral, setSavedGeneral] = useState(false);
  const debouncedGeneral = useDebounce(generalForm, 1800);
  const isInitialMount = useRef(true);

  const [posConfig, setPosConfig] = useState<PosConfig>({
    autoPrintKOT: true, autoPrintReceipt: false,
    requireShiftOpening: true, blockOutOfStock: true, offlineMode: true,
  });

  const [kitchen, setKitchen] = useState<KitchenSettings>({ useKDS: false, autoPrintKOT: true });

  const [receipt, setReceipt] = useState<ReceiptSettings>({
    taxDisplay: "separate",
    cashTaxEnabled: true, cashTaxRate: 5, cashTaxLabel: "GST (Cash)",
    cardTaxEnabled: true, cardTaxRate: 17, cardTaxLabel: "GST (Card/Digital)",
    showDualTaxOnReceipt: true,
    cashTaxNote: "", cardTaxNote: "",
    taxRoundingMethod: "ROUND",
    paperSize: "80mm",
    headerMessage: "", footerMessage: "Thank you for dining with us!",
    showPoweredBy: true, showLogo: true, showCashierName: true, showTableNumber: true,
    showTaxBreakdown: true, cashShowTendered: true, cashShowChange: true, cardShowMethod: true,
    serviceChargeEnabled: false, serviceChargeRate: 10,
    fbrEnabled: false, fbrNtn: "", fbrPosId: "",
    downloadPdfReceipt: false,
    layout: "CLASSIC",
  });
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState(false);

  const [branding, setBranding] = useState({
    restaurantName: "", primaryColor: "#6366F1", secondaryColor: "#0F172A",
    accentColor: "#F59E0B", logoUrl: "",
  });
  const [savingBranding, setSavingBranding] = useState(false);
  const [savedBranding, setSavedBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const [notifications, setNotifications] = useState({
    dailySummary: { email: true, push: false },
    lowStock: { email: true, sms: true },
    newOrder: { push: true, email: false },
  });

  const [sessions, setSessions] = useState<any[]>([]);
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwStatus, setPwStatus] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        if (!isBranchManager) {
          const s = await apiFetch<any>("/api/settings").catch(() => null);
          if (s?.settings) {
            const st = s.settings;
            if (st.general) {
              const bName = (st.general.businessName || "").trim() ? st.general.businessName : s.name;
              setGeneralForm(p => ({ ...p, ...st.general, businessName: bName || "" }));
            }
            else if (s?.name) setGeneralForm(p => ({ ...p, businessName: s.name }));
            if (st.pos) setPosConfig(p => ({ ...p, ...st.pos }));
            if (st.receipt) setReceipt(p => ({ ...p, ...st.receipt }));
            if (st.kitchen) setKitchen(p => ({ ...p, ...st.kitchen }));
          } else if (s?.name) {
            setGeneralForm(p => ({ ...p, businessName: s.name }));
          }
          const b = await apiFetch<any>("/api/settings/branding").catch(() => null);
          if (b) {
            const restName = (b.restaurantName || "").trim() ? b.restaurantName : (s?.name || "");
            setBranding(p => ({ ...p, restaurantName: restName, primaryColor: b.primaryColor || p.primaryColor, secondaryColor: b.secondaryColor || p.secondaryColor, logoUrl: b.logoUrl || "" }));
            // Hydrate dual-tax into receipt settings from branding
            if (b.cashTaxRate !== undefined || b.cardTaxRate !== undefined) {
              setReceipt(p => ({
                ...p,
                cashTaxEnabled: b.cashTaxEnabled ?? p.cashTaxEnabled,
                cashTaxRate: b.cashTaxRate ?? p.cashTaxRate,
                cashTaxLabel: b.cashTaxLabel ?? p.cashTaxLabel,
                cardTaxEnabled: b.cardTaxEnabled ?? p.cardTaxEnabled,
                cardTaxRate: b.cardTaxRate ?? p.cardTaxRate,
                cardTaxLabel: b.cardTaxLabel ?? p.cardTaxLabel,
                showDualTaxOnReceipt: b.showDualTaxOnReceipt ?? p.showDualTaxOnReceipt,
                cashTaxNote: b.cashTaxNote ?? p.cashTaxNote,
                cardTaxNote: b.cardTaxNote ?? p.cardTaxNote,
                taxRoundingMethod: b.taxRoundingMethod ?? p.taxRoundingMethod,
                serviceChargeEnabled: b.serviceChargeEnabled ?? p.serviceChargeEnabled,
                serviceChargeRate: b.serviceChargeRate ?? p.serviceChargeRate,
                fbrEnabled: b.fbrEnabled ?? p.fbrEnabled,
                fbrNtn: b.fbrNtn ?? p.fbrNtn,
                fbrPosId: b.fbrPosId ?? p.fbrPosId,
                showLogo: b.showLogoOnReceipt ?? p.showLogo,
                showCashierName: b.showCashierName ?? p.showCashierName,
                showTableNumber: b.showTableNumber ?? p.showTableNumber,
                headerMessage: b.receiptHeader ?? p.headerMessage,
                footerMessage: b.receiptFooter ?? p.footerMessage,
                showTaxBreakdown: b.showTaxBreakdown ?? p.showTaxBreakdown,
                downloadPdfReceipt: b.downloadPdfReceipt ?? p.downloadPdfReceipt,
                paperSize: b.receiptPaperSize ?? p.paperSize,
                layout: b.receiptLayout ?? p.layout,
                showPoweredBy: b.showPoweredBy ?? p.showPoweredBy,
                cashShowTendered: b.cashShowTendered ?? p.cashShowTendered,
                cashShowChange: b.cashShowChange ?? p.cashShowChange,
                cardShowMethod: b.cardShowMethod ?? p.cardShowMethod,
              }));
            }
          }
        }
        const u = await apiFetch<any>("/api/settings/user").catch(() => null);
        if (u?.notificationPreferences) setNotifications(p => ({ ...p, ...u.notificationPreferences }));
        const se = await apiFetch<any>("/api/settings/sessions").catch(() => null);
        setSessions(se?.sessions || []);
      } catch (err) { console.error(err); }
    })();
  }, [isBranchManager]);

  // ── Auto-save general ─────────────────────────────────────────────────────

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (isBranchManager) return;
    setSavingGeneral(true);
    apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ general: debouncedGeneral }) })
      .then(() => { setSavedGeneral(true); setTimeout(() => setSavedGeneral(false), 3000); })
      .catch(() => toast.error("Failed to save"))
      .finally(() => setSavingGeneral(false));
  }, [debouncedGeneral, isBranchManager]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePOS = async (key: keyof PosConfig, val: boolean) => {
    const prev = posConfig;
    const next = { ...posConfig, [key]: val };
    setPosConfig(next);
    try { await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ pos: next }) }); }
    catch { setPosConfig(prev); toast.error("Failed to save"); }
  };

  const handleKitchen = async (key: keyof KitchenSettings, val: boolean) => {
    const prev = kitchen;
    const next = { ...kitchen, [key]: val };
    setKitchen(next);
    try { await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify({ kitchen: next }) }); toast.success("Saved"); }
    catch { setKitchen(prev); toast.error("Failed to save"); }
  };

  const saveReceipt = async () => {
    setSavingReceipt(true);
    try {
      // Save dual-tax config through branding endpoint
      await apiFetch("/api/settings/branding", {
        method: "PUT",
        body: JSON.stringify({
          cashTaxEnabled: receipt.cashTaxEnabled,
          cashTaxRate: receipt.cashTaxRate,
          cashTaxLabel: receipt.cashTaxLabel,
          cardTaxEnabled: receipt.cardTaxEnabled,
          cardTaxRate: receipt.cardTaxRate,
          cardTaxLabel: receipt.cardTaxLabel,
          showDualTaxOnReceipt: receipt.showDualTaxOnReceipt,
          cashTaxNote: receipt.cashTaxNote,
          cardTaxNote: receipt.cardTaxNote,
          taxRoundingMethod: receipt.taxRoundingMethod,
          serviceChargeEnabled: receipt.serviceChargeEnabled,
          serviceChargeRate: receipt.serviceChargeRate,
          fbrEnabled: receipt.fbrEnabled,
          fbrNtn: receipt.fbrNtn,
          fbrPosId: receipt.fbrPosId,
          showLogoOnReceipt: receipt.showLogo,
          showCashierName: receipt.showCashierName,
          showTableNumber: receipt.showTableNumber,
          receiptHeader: receipt.headerMessage,
          receiptFooter: receipt.footerMessage,
          showTaxBreakdown: receipt.showTaxBreakdown,
          receiptPaperSize: receipt.paperSize,
          receiptLayout: receipt.layout,
          downloadPdfReceipt: receipt.downloadPdfReceipt,
          cashShowTendered: receipt.cashShowTendered,
          cashShowChange: receipt.cashShowChange,
          cardShowMethod: receipt.cardShowMethod,
          showPoweredBy: receipt.showPoweredBy,
        })
      });
      setSavedReceipt(true);
      setTimeout(() => setSavedReceipt(false), 3000);
      toast.success("Receipt settings saved");
    } catch {
      toast.error("Failed to save receipt settings");
    } finally {
      setSavingReceipt(false);
    }
  };

  const saveBranding = async () => {
    setSavingBranding(true);
    try {
      await apiFetch("/api/settings/branding", { method: "PUT", body: JSON.stringify({ restaurantName: branding.restaurantName, primaryColor: branding.primaryColor, secondaryColor: branding.secondaryColor, logoUrl: branding.logoUrl }) });
      setSavedBranding(true); setTimeout(() => setSavedBranding(false), 3000);
    } catch { toast.error("Failed to save branding"); }
    finally { setSavingBranding(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "logo");
      const res = await fetch(`${API_URL}/api/settings/branding/upload`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json(); setBranding(p => ({ ...p, logoUrl: data.url })); toast.success("Logo uploaded");
    } catch { toast.error("Upload failed"); } finally { setUploadingLogo(false); }
  };

  const handleNotif = async (topic: string, channel: string, val: boolean) => {
    const prev = notifications;
    const next = { ...notifications, [topic]: { ...(notifications as any)[topic], [channel]: val } };
    setNotifications(next as any);
    try { await apiFetch("/api/settings/notifications", { method: "PUT", body: JSON.stringify({ preferences: next }) }); }
    catch { setNotifications(prev); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.new.length < 8) { setPwStatus({ type: "error", msg: "Minimum 8 characters" }); return; }
    if (pwForm.new !== pwForm.confirm) { setPwStatus({ type: "error", msg: "Passwords do not match" }); return; }
    try {
      setPwStatus(null);
      await apiFetch("/api/settings/change-password", { method: "PUT", body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }) });
      setPwStatus({ type: "success", msg: "Password updated" }); setPwForm({ current: "", new: "", confirm: "" });
    } catch (err: any) { setPwStatus({ type: "error", msg: err.message || "Failed to update" }); }
  };

  const revokeSession = async (id: string) => {
    try { await apiFetch(`/api/settings/sessions/${id}`, { method: "DELETE" }); setSessions(s => s.filter(x => x.id !== id)); }
    catch { toast.error("Failed to revoke"); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const visibleNav = isBranchManager
    ? NAV.filter(n => ["notifications", "security"].includes(n.id))
    : NAV;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#F8FAFC]">

      {/* ── Left Nav ── */}
      <aside className="w-52 shrink-0 border-r border-[#E2E8F0] bg-white overflow-y-auto hidden md:flex flex-col">
        <div className="px-3 py-5">
          <p className="px-3 text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest mb-2">Settings</p>
          <nav className="space-y-0.5">
            {visibleNav.map(item => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2
                    ${active
                      ? item.danger ? "bg-red-50 text-red-600" : "bg-[#F1F5FF] text-[#4F46E5]"
                      : item.danger ? "text-[#94A3B8] hover:text-red-500 hover:bg-red-50"
                        : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                >
                  {active && (
                    <span className={`w-1 h-4 rounded-full shrink-0 ${item.danger ? "bg-red-400" : "bg-[#6366F1]"}`} />
                  )}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ── Panel Content (only active section shown) ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[700px] mx-auto px-8 py-8 pb-16">

          {/* ══ GENERAL ══════════════════════════════════════════════════════ */}
          {activeSection === 'general' && !isBranchManager && (
            <Section
              title="General"
              description="Your business identity for invoices and compliance."
              action={<SaveStatus saving={savingGeneral} saved={savedGeneral} />}
            >
              <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-5">
                <Input label="Business Name" value={generalForm.businessName} onChange={v => setGeneralForm(p => ({ ...p, businessName: v }))} placeholder="e.g. The Karahi House" />
                <Input label="Legal Name" value={generalForm.legalName} onChange={v => setGeneralForm(p => ({ ...p, legalName: v }))} placeholder="Registered entity name" />
                <Input label="NTN / STRN" value={generalForm.taxRegistration} onChange={v => setGeneralForm(p => ({ ...p, taxRegistration: v }))} placeholder="1234567-8" hint="Required for FBR integration" />
                <Select
                  label="Business Type"
                  value={generalForm.businessType}
                  onChange={v => setGeneralForm(p => ({ ...p, businessType: v }))}
                  options={[
                    { value: "Fine Dining", label: "Fine Dining" },
                    { value: "Fast Food", label: "Fast Food" },
                    { value: "Cafe / Bakery", label: "Cafe / Bakery" },
                    { value: "Dhaba", label: "Dhaba" },
                    { value: "Retail Store", label: "Retail Store" },
                  ]}
                />
                <Input label="City" value={generalForm.city} onChange={v => setGeneralForm(p => ({ ...p, city: v }))} placeholder="Karachi" />
                <Select
                  label="Currency"
                  value={generalForm.currency}
                  onChange={v => setGeneralForm(p => ({ ...p, currency: v }))}
                  options={[
                    { value: "PKR", label: "PKR — Pakistani Rupee" },
                    { value: "USD", label: "USD — US Dollar" },
                    { value: "AED", label: "AED — UAE Dirham" },
                  ]}
                />
              </div>
            </Section>
          )}

          {/* ══ POS ══════════════════════════════════════════════════════════ */}
          {activeSection === 'pos' && !isBranchManager && (
            <Section title="Point of Sale" description="Terminal behaviour and cashier workflow rules.">
              <div className="divide-y divide-[#F1F5F9]">
                <SettingRow label="Auto-print KOT on order" hint="Immediately send a kitchen ticket to the printer when an order is placed." checked={posConfig.autoPrintKOT} onChange={v => handlePOS("autoPrintKOT", v)} />
                <SettingRow label="Auto-print receipt on payment" hint="Print customer receipt as soon as payment is confirmed." checked={posConfig.autoPrintReceipt} onChange={v => handlePOS("autoPrintReceipt", v)} />
                <SettingRow label="Require shift opening" hint="Cashiers must open a shift with an opening float before taking orders." checked={posConfig.requireShiftOpening} onChange={v => handlePOS("requireShiftOpening", v)} />
                <SettingRow label="Block out-of-stock items" hint="Prevent adding items with zero inventory to an order." checked={posConfig.blockOutOfStock} onChange={v => handlePOS("blockOutOfStock", v)} />
                <SettingRow label="Offline mode" hint="Continue taking orders when the internet connection is unavailable." checked={posConfig.offlineMode} onChange={v => handlePOS("offlineMode", v)} />
              </div>
            </Section>
          )}

          {/* ══ RECEIPTS ════════════════════════════════════════════════ */}
          {activeSection === 'receipt' && !isBranchManager && (
            <Section
              title="Receipts"
              description="How printed and digital receipts look for your customers."
              action={<SaveButton onClick={saveReceipt} saving={savingReceipt} saved={savedReceipt} />}
            >
              {/* Two-column layout: settings left, preview right */}
              <div className="flex min-h-0">
                {/* Left: Settings */}
                <div className="flex-1 min-w-0 divide-y divide-[#F1F5F9]">

                  {/* ── Tax Rates ── */}
                  <div className="px-6 pt-5 pb-1">
                    <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Tax Rates</p>
                  </div>

                  {/* Cash GST toggle + row */}
                  <SettingRow label="Enable Cash GST" hint="Apply GST to cash payments." checked={receipt.cashTaxEnabled} onChange={v => setReceipt(p => ({ ...p, cashTaxEnabled: v }))} />
                  {receipt.cashTaxEnabled && (
                    <SettingRow label="Cash GST rate" hint="Applied when customer pays with cash.">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={receipt.cashTaxLabel}
                          onChange={e => setReceipt(p => ({ ...p, cashTaxLabel: e.target.value }))}
                          className="w-28 h-8 border border-[#E2E8F0] bg-white rounded-lg px-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1]"
                          placeholder="GST (Cash)"
                        />
                        <NumberInput value={receipt.cashTaxRate} onChange={v => setReceipt(p => ({ ...p, cashTaxRate: v }))} min={0} max={50} step={0.5} suffix="%" />
                      </div>
                    </SettingRow>
                  )}

                  {/* Card GST toggle + row */}
                  <SettingRow label="Enable Card / Digital GST" hint="Apply GST to card and mobile wallet payments." checked={receipt.cardTaxEnabled} onChange={v => setReceipt(p => ({ ...p, cardTaxEnabled: v }))} />
                  {receipt.cardTaxEnabled && (
                    <SettingRow label="Card / digital GST rate" hint="Applied when customer pays by card, JazzCash, or EasyPaisa.">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={receipt.cardTaxLabel}
                          onChange={e => setReceipt(p => ({ ...p, cardTaxLabel: e.target.value }))}
                          className="w-28 h-8 border border-[#E2E8F0] bg-white rounded-lg px-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15 focus:border-[#6366F1]"
                          placeholder="GST (Card/Digital)"
                        />
                        <NumberInput value={receipt.cardTaxRate} onChange={v => setReceipt(p => ({ ...p, cardTaxRate: v }))} min={0} max={50} step={0.5} suffix="%" />
                      </div>
                    </SettingRow>
                  )}

                  {/* Show dual totals — only relevant if both are on */}
                  {receipt.cashTaxEnabled && receipt.cardTaxEnabled && (
                    <SettingRow label="Show both totals on receipt" hint="Print Cash total and Card total before the customer pays so they can choose." checked={receipt.showDualTaxOnReceipt} onChange={v => setReceipt(p => ({ ...p, showDualTaxOnReceipt: v }))} />
                  )}

                  <SettingRow label="Tax rounding" hint="How fractional tax is rounded to a whole number.">
                    <select
                      value={receipt.taxRoundingMethod}
                      onChange={e => setReceipt(p => ({ ...p, taxRoundingMethod: e.target.value as any }))}
                      className="h-8 px-3 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/15"
                    >
                      <option value="ROUND">Round (nearest)</option>
                      <option value="FLOOR">Floor (always down)</option>
                      <option value="CEIL">Ceil (always up)</option>
                    </select>
                  </SettingRow>

                  {/* Service Charge — enable toggle first, rate only if enabled */}
                  <SettingRow label="Enable service charge" hint="Add a surcharge as a separate line item on every bill." checked={receipt.serviceChargeEnabled} onChange={v => setReceipt(p => ({ ...p, serviceChargeEnabled: v }))} />
                  {receipt.serviceChargeEnabled && (
                    <SettingRow label="Service charge rate" hint="Percentage added on top of subtotal.">
                      <NumberInput value={receipt.serviceChargeRate} onChange={v => setReceipt(p => ({ ...p, serviceChargeRate: v }))} min={0} max={30} step={0.5} suffix="%" />
                    </SettingRow>
                  )}

                  <div className="px-6 py-4">
                    <Select label="Paper size" value={receipt.paperSize} onChange={v => setReceipt(p => ({ ...p, paperSize: v as any }))} options={[{ value: "80mm", label: "80mm (Thermal)" }, { value: "A4", label: "A4 (Standard)" }]} />
                  </div>

                  {/* Receipt Layout Style */}
                  <div className="px-6 py-4 border-t border-[#F1F5F9]">
                    <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Receipt Layout Style</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'CLASSIC', label: 'Classic', desc: 'Detailed columns with separators' },
                        { id: 'MINIMAL', label: 'Minimal', desc: 'Clean, no item numbers, compact' },
                        { id: 'MODERN', label: 'Modern', desc: 'Spaced out, bold headers, solid lines' }
                      ].map(l => (
                        <div 
                          key={l.id}
                          onClick={() => setReceipt(p => ({ ...p, layout: l.id }))}
                          className={`cursor-pointer border rounded-lg p-3 flex flex-col gap-1 transition-all ${receipt.layout === l.id ? 'border-[#6366F1] bg-[#6366F1]/5 ring-1 ring-[#6366F1]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}
                        >
                          <div className="font-semibold text-[13px] text-[#0F172A]">{l.label}</div>
                          <div className="text-[11px] text-[#64748B] leading-tight">{l.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment display */}
                  <div className="divide-y divide-[#F1F5F9]">
                    <div className="px-6 py-4">
                      <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Payment on receipt</p>
                    </div>
                    <SettingRow label="Show tax breakdown" hint="Print GST as a separate line item." checked={receipt.showTaxBreakdown} onChange={v => setReceipt(p => ({ ...p, showTaxBreakdown: v }))} />
                    <SettingRow label="Enable service charge" hint="Show service charge as a line item." checked={receipt.serviceChargeEnabled} onChange={v => setReceipt(p => ({ ...p, serviceChargeEnabled: v }))} />
                    <SettingRow label="Cash — show amount tendered" hint="Print the cash amount the customer handed over." checked={receipt.cashShowTendered} onChange={v => setReceipt(p => ({ ...p, cashShowTendered: v }))} />
                    <SettingRow label="Cash — show change returned" hint="Print the change given back." checked={receipt.cashShowChange} onChange={v => setReceipt(p => ({ ...p, cashShowChange: v }))} />
                    <SettingRow label='Card — show "Paid by Card ✓"' hint="Confirmation line for card and digital payments." checked={receipt.cardShowMethod} onChange={v => setReceipt(p => ({ ...p, cardShowMethod: v }))} />
                  </div>

                  {/* Receipt content */}
                  <div className="divide-y divide-[#F1F5F9]">
                    <div className="px-6 py-4">
                      <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Receipt content</p>
                    </div>
                    <SettingRow label="Show restaurant logo" checked={receipt.showLogo} onChange={v => setReceipt(p => ({ ...p, showLogo: v }))} />
                    <SettingRow label="Show cashier name" checked={receipt.showCashierName} onChange={v => setReceipt(p => ({ ...p, showCashierName: v }))} />
                    <SettingRow label="Show table number" checked={receipt.showTableNumber} onChange={v => setReceipt(p => ({ ...p, showTableNumber: v }))} />
                    <SettingRow label='Show "Powered by Dineiz"' hint="Branding footer at the bottom of every receipt." checked={receipt.showPoweredBy} onChange={v => setReceipt(p => ({ ...p, showPoweredBy: v }))} />
                    <SettingRow label="Download PDF receipt" hint="Download a PDF of the receipt instead of printing it directly." checked={receipt.downloadPdfReceipt} onChange={v => setReceipt(p => ({ ...p, downloadPdfReceipt: v }))} />
                  </div>

                  {/* Messages */}
                  <div className="px-6 py-5 space-y-4">
                    <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Messages</p>
                    <Textarea label="Header message" value={receipt.headerMessage} onChange={v => setReceipt(p => ({ ...p, headerMessage: v }))} placeholder="Printed just below the restaurant name" rows={2} />
                    <Textarea label="Footer message" value={receipt.footerMessage} onChange={v => setReceipt(p => ({ ...p, footerMessage: v }))} placeholder="e.g. Thank you for dining with us!" rows={2} />
                  </div>

                  {/* FBR */}
                  <div className="divide-y divide-[#F1F5F9]">
                    <div className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">FBR / PRA Integration</p>
                        <p className="text-[12px] text-[#94A3B8] mt-0.5">Print FBR invoice number and QR code on receipts</p>
                      </div>
                      <Toggle checked={receipt.fbrEnabled} onChange={v => setReceipt(p => ({ ...p, fbrEnabled: v }))} />
                    </div>
                    {receipt.fbrEnabled && (
                      <div className="px-6 py-4 grid grid-cols-2 gap-4">
                        <Input label="FBR NTN" value={receipt.fbrNtn} onChange={v => setReceipt(p => ({ ...p, fbrNtn: v }))} placeholder="1234567-8" />
                        <Input label="POS ID" value={receipt.fbrPosId} onChange={v => setReceipt(p => ({ ...p, fbrPosId: v }))} placeholder="Assigned by FBR" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Live Preview */}
                <div className="w-[220px] shrink-0 border-l border-[#F1F5F9] bg-[#F8FAFC]">
                  <div className="flex flex-col items-center py-8 px-4 gap-4 sticky top-6">
                    <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Preview</p>
                    <div className="shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-sm overflow-hidden">
                      <ThermalReceiptPreview settings={receipt} branding={branding} generalForm={generalForm} />
                    </div>
                    <p className="text-[10px] text-[#CBD5E1] text-center">Updates as you type</p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* ══ KITCHEN & KDS ════════════════════════════════════════════════ */}
          {activeSection === 'kitchen' && !isBranchManager && (
            <Section title="Kitchen &amp; KDS" description="Control how orders flow from the POS to your kitchen.">

              {/* Callout */}
              <div className="mx-6 mt-5 mb-4 px-4 py-3 bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg flex gap-3 text-[12.5px] text-[#4338CA] leading-relaxed">
                <span className="shrink-0 mt-0.5 text-[14px]">💡</span>
                <div>
                  <strong className="font-semibold">KDS = Kitchen Display System.</strong> Enable this only if your kitchen has a dedicated screen running the KDS app. Without one, your cashier controls order status manually.
                </div>
              </div>

              <div className="divide-y divide-[#F1F5F9] mt-4">
                <SettingRow
                  label="Use Kitchen Display System (KDS)"
                  hint={kitchen.useKDS
                    ? "Orders transition: Pending → In Kitchen (KDS marks them ready)"
                    : "Orders transition: Pending → Ready (cashier marks them ready manually)"
                  }
                  checked={kitchen.useKDS}
                  onChange={v => handleKitchen("useKDS", v)}
                />
                <SettingRow
                  label="Auto-print Kitchen Order Ticket (KOT)"
                  hint="Print a kitchen ticket when an order is placed, regardless of KDS."
                  checked={kitchen.autoPrintKOT}
                  onChange={v => handleKitchen("autoPrintKOT", v)}
                />
              </div>

              {/* Status flow */}
              <div className="px-6 py-5 border-t border-[#F1F5F9]">
                <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">Order status flow</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(kitchen.useKDS
                    ? [
                      { label: "Pending", color: "bg-amber-100 text-amber-700" },
                      null,
                      { label: "In Kitchen", color: "bg-blue-100 text-blue-700" },
                      null,
                      { label: "Ready", color: "bg-green-100 text-green-700" },
                      null,
                      { label: "Completed", color: "bg-gray-100 text-gray-600" },
                    ]
                    : [
                      { label: "Pending", color: "bg-amber-100 text-amber-700" },
                      null,
                      { label: "Ready", color: "bg-green-100 text-green-700" },
                      null,
                      { label: "Completed", color: "bg-gray-100 text-gray-600" },
                    ]
                  ).map((s, i) =>
                    s === null
                      ? <ChevronRight key={i} className="w-3.5 h-3.5 text-[#CBD5E1]" />
                      : <span key={i} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${s.color}`}>{s.label}</span>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ══ BRANDING ═════════════════════════════════════════════════════ */}
          {activeSection === 'branding' && !isBranchManager && (
            <Section
              title="Branding"
              description="Visual identity across POS, receipts, and QR menus."
              action={<SaveButton onClick={saveBranding} saving={savingBranding} saved={savedBranding} />}
            >
              <div className="p-6 space-y-6">
                <Input label="Display name" value={branding.restaurantName} onChange={v => setBranding(p => ({ ...p, restaurantName: v }))} placeholder={generalForm.businessName || "e.g. The Karahi House"} hint="Shown on POS screen, receipts, and QR menu." />

                {/* Logo */}
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Logo</p>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center overflow-hidden shrink-0">
                      {branding.logoUrl
                        ? <img src={branding.logoUrl} className="w-full h-full object-contain" alt="Logo" />
                        : <span className="text-[#CBD5E1] text-[10px] font-medium">No logo</span>
                      }
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => logoRef.current?.click()}
                        disabled={uploadingLogo}
                        className="h-8 px-3 flex items-center gap-1.5 border border-[#E2E8F0] bg-white rounded-md text-[12.5px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {uploadingLogo ? "Uploading…" : "Upload logo"}
                      </button>
                      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <p className="text-[11px] text-[#94A3B8]">PNG or JPG. 400×400px recommended.</p>
                      {branding.logoUrl && (
                        <button onClick={() => setBranding(p => ({ ...p, logoUrl: "" }))} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">Remove</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">Brand colors</p>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { key: "primaryColor", label: "Primary" },
                      { key: "secondaryColor", label: "Secondary" },
                      { key: "accentColor", label: "Accent" },
                    ] as const).map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <p className="text-[11.5px] text-[#64748B]">{label}</p>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <input type="color" value={branding[key]} onChange={e => setBranding(p => ({ ...p, [key]: e.target.value }))} className="sr-only" id={`color-${key}`} />
                            <label htmlFor={`color-${key}`} className="w-8 h-8 rounded border border-[#E2E8F0] cursor-pointer block" style={{ background: branding[key] }} />
                          </div>
                          <input
                            value={branding[key]}
                            onChange={e => setBranding(p => ({ ...p, [key]: e.target.value }))}
                            className="flex-1 h-8 border border-[#E2E8F0] rounded-md px-2 text-[11.5px] font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* ══ NOTIFICATIONS ════════════════════════════════════════════════ */}
          {activeSection === 'notifications' && (
            <Section title="Notifications" description="Choose how and when you receive alerts.">
              <div className="divide-y divide-[#F1F5F9]">
                {[
                  { key: "dailySummary", label: "Daily sales summary", hint: "End-of-day report of branch performance.", channels: ["email", "push"] as const },
                  { key: "lowStock", label: "Low stock alerts", hint: "Alert when ingredients fall below reorder threshold.", channels: ["email", "sms"] as const },
                  { key: "newOrder", label: "New order alerts", hint: "Alert when an order arrives via aggregator or QR.", channels: ["push", "email"] as const },
                ].map(({ key, label, hint, channels }) => (
                  <div key={key} className="flex items-start justify-between gap-6 py-4 px-6">
                    <FieldLabel label={label} hint={hint} />
                    <div className="flex items-center gap-3 shrink-0">
                      {channels.map(ch => (
                        <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(notifications as any)[key]?.[ch] ?? false}
                            onChange={e => handleNotif(key, ch, e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-[#6366F1]"
                          />
                          <span className="text-[12px] text-[#64748B] capitalize">{ch}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ══ SECURITY ═════════════════════════════════════════════════════ */}
          {activeSection === 'security' && (
            <Section title="Security" description="Password and active login sessions.">
              {/* Change password */}
              <div className="px-6 py-5 space-y-4 border-b border-[#F1F5F9]">
                <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Change password</p>
                {pwStatus && (
                  <div className={`px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium border ${pwStatus.type === "error"
                      ? "bg-red-50 border-red-100 text-red-700"
                      : "bg-green-50 border-green-100 text-green-700"
                    }`}>
                    {pwStatus.msg}
                  </div>
                )}
                <form onSubmit={handlePassword} className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Input type="password" label="Current password" value={pwForm.current} onChange={v => setPwForm(p => ({ ...p, current: v }))} required placeholder="Current password" />
                    <Input type="password" label="New password" value={pwForm.new} onChange={v => setPwForm(p => ({ ...p, new: v }))} required placeholder="Min. 8 characters" />
                    <Input type="password" label="Confirm new password" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} required placeholder="Repeat new password" />
                  </div>
                  <button
                    type="submit"
                    className="h-8 px-4 bg-[#0F172A] text-white text-[12.5px] font-semibold rounded-md hover:bg-[#1E293B] transition-colors"
                  >
                    Update password
                  </button>
                </form>
              </div>

              {/* Sessions */}
              <div className="px-6 py-5 space-y-3">
                <p className="text-[10.5px] font-bold text-[#94A3B8] uppercase tracking-widest">Active sessions</p>
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                      </svg>
                    </div>
                    <p className="text-[13px] font-medium text-[#0F172A]">Only this session</p>
                    <p className="text-[12px] text-[#94A3B8]">You have no other active sessions on other devices.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F1F5F9] border border-[#E2E8F0] rounded-lg overflow-hidden">
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                        <div>
                          <p className="text-[13px] font-medium text-[#0F172A]">{s.token?.slice(0, 10)}… (Device)</p>
                          <p className="text-[11.5px] text-[#94A3B8] mt-0.5">Last active {new Date(s.updatedAt).toLocaleString()}</p>
                        </div>
                        <button onClick={() => revokeSession(s.id)} className="text-[12px] font-medium text-red-500 hover:text-red-700 transition-colors px-2 py-1 hover:bg-red-50 rounded">
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}


          {/* ══ DANGER ZONE ════════════════════════════════════════════════════ */}
          {activeSection === 'danger' && !isBranchManager && (
            <div className="border border-[#FECACA] rounded-xl overflow-hidden bg-white">
              <div className="px-6 py-5 border-b border-[#FEE2E2] bg-red-50/60 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <h3 className="text-[14px] font-semibold text-red-700">Danger Zone</h3>
              </div>
              <div className="divide-y divide-[#FEF2F2]">
                <div className="flex items-start justify-between gap-6 px-6 py-5">
                  <div>
                    <p className="text-[13.5px] font-medium text-[#0F172A]">Export all data</p>
                    <p className="text-[12px] text-[#64748B] mt-0.5">Download all transactions, menu, and inventory data as a ZIP archive.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Export all business data?")) return;
                      try { const r = await apiFetch<any>("/api/settings/export-data", { method: "POST" }); toast.success(r.message); }
                      catch (e: any) { toast.error(e.message || "Export failed"); }
                    }}
                    className="shrink-0 h-8 px-4 border border-[#E2E8F0] bg-white text-[12.5px] font-medium text-[#0F172A] rounded-md hover:bg-[#F8FAFC] transition-colors"
                  >
                    Export (.zip)
                  </button>
                </div>
                <div className="flex items-start justify-between gap-6 px-6 py-5">
                  <div>
                    <p className="text-[13.5px] font-semibold text-red-700">Delete account</p>
                    <p className="text-[12px] text-[#64748B] mt-0.5">Permanently delete this account and all data. This cannot be undone.</p>
                  </div>
                  <button
                    onClick={() => {
                      if (prompt('Type DELETE to confirm') !== 'DELETE') return;
                      toast.error("Contact support to complete account deletion.");
                    }}
                    className="shrink-0 h-8 px-4 bg-red-600 text-white text-[12.5px] font-semibold rounded-md hover:bg-red-700 transition-colors"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
