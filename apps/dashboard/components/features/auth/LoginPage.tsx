import { LoginForm } from "./LoginForm";
import { DineizLogo } from "@/components/ui/DineizLogo";

export function LoginPage() {
  return (
    <div className="w-full min-h-screen grid lg:grid-cols-2 bg-white select-none">
      {/* ── LEFT PANEL (Classy Dark Kitchen Atmosphere) ──────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-12 lg:p-16 overflow-hidden select-none"
        style={{ background: "#0f172a" }}
      >
        {/* Classy Background Kitchen Image (Non-draggable, pointer-events disabled) */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwqOxYLAHuTk_9GRla0OKRez31-eNE1nt0gqdNfqijwxupsOq1-pexXN-NVMTOMjiaaGpT4_bx56fACoJpqKD_FOIREc8zps1NgI_PdskJHNDZn9DSZxS9cQAaZrTt3YuLfqCaMDPwijllxjOsR0tqAap58ouwXNR-zZqOEdfMpaknLqRA8e8nwiKAR93YnyzLY1knO-UuzzooJMK9pe7oO-DKxAea0PMo3YI_veXSy7LS0jIZLnc6q2ZQeDqDF4KFI56I41KvLqVL"
            alt="Professional kitchen atmosphere"
            draggable={false}
            className="w-full h-full object-cover pointer-events-none select-none"
            style={{ opacity: 0.35, filter: "grayscale(100%)", mixBlendMode: "overlay" }}
          />
        </div>

        {/* Subtle Accent Glow */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[140px] pointer-events-none"
          style={{ background: "rgba(255, 107, 53, 0.15)" }}
        />

        {/* Top Header Logo */}
        <div className="relative z-10">
          <DineizLogo size="lg" variant="dark" />
        </div>

        {/* Center Minimal Headline (Executive & Modern SaaS Copy) */}
        <div className="relative z-10 my-auto max-w-md">
          <h1
            className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white mb-4"
            style={{ letterSpacing: "-0.02em" }}
          >
            The complete intelligence platform for modern dining.
          </h1>

          <p
            className="text-base font-normal leading-relaxed text-slate-400"
          >
            Real-time control over multi-branch operations, kitchen workflows, and revenue performance.
          </p>
        </div>

        {/* Bottom Version Info */}
        <div className="relative z-10 flex items-center gap-3 text-xs font-medium text-slate-500 select-none">
          <span>Dineiz v3.0 Enterprise Edition</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>&copy; {new Date().getFullYear()} Dineiz Systems</span>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center items-center w-full py-12 px-6 sm:px-12 lg:px-16 bg-white">
        <LoginForm />
      </div>
    </div>
  );
}
