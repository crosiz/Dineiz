"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { DineizLogo } from "@/components/ui/DineizLogo";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: forgotEmail.trim(),
        redirectTo: "/reset-password",
      });
      // Always show the same confirmation regardless of whether the email
      // matched an account — don't leak which emails are registered.
      setForgotSent(true);
    } catch {
      toast.error("Couldn't send reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null);
    setIsLoading(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setApiError(error.message ?? "Sign in failed. Please check your credentials.");
        return;
      }

      const role = (data?.user as any)?.role as string | undefined;
      const posRoles = ["CASHIER", "WAITER", "KITCHEN_STAFF"];
      if (role && posRoles.includes(role)) {
        setApiError("Access denied: POS personnel must log in via the POS application.");
        await authClient.signOut();
        return;
      }

      router.push("/dashboard");
    } catch {
      setApiError("Network connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="w-full max-w-[420px] mx-auto">
        <div className="lg:hidden flex justify-center mb-8">
          <DineizLogo size="md" variant="light" />
        </div>

        <div className="mb-8 text-center lg:text-left">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-[#0D1117] tracking-tight mb-2">
            Reset your password
          </h2>
          <p className="text-sm text-slate-500 font-normal leading-relaxed">
            {forgotSent
              ? "If that email matches an account, a reset link is on its way."
              : "Enter the email on your account and we'll send you a reset link."}
          </p>
        </div>

        {forgotSent ? (
          <button
            type="button"
            onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); }}
            className="w-full h-11 rounded-lg text-sm font-semibold text-[#0D1117] bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Back to sign in
          </button>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="forgotEmail" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Email Address
              </label>
              <input
                id="forgotEmail"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@dineiz.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-lg text-sm text-[#0D1117] bg-slate-50 border border-slate-200 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/20 transition-all duration-150 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #FF6B35 0%, #E63946 100%)" }}
            >
              {forgotLoading ? "Sending…" : "Send reset link"}
            </button>

            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* Mobile Header Logo */}
      <div className="lg:hidden flex justify-center mb-8">
        <DineizLogo size="md" variant="light" />
      </div>

      {/* Form Header */}
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-[#0D1117] tracking-tight mb-2">
          Welcome back
        </h2>
        <p className="text-sm text-slate-500 font-normal leading-relaxed">
          Sign in to access your Dineiz Management Dashboard
        </p>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Email Address
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@dineiz.com"
              {...register("email")}
              className={`w-full h-11 pl-10 pr-4 rounded-lg text-sm text-[#0D1117] bg-slate-50 border transition-all duration-150 outline-none ${
                errors.email
                  ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-slate-200 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/20"
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 font-medium pt-0.5">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs font-medium text-[#FF6B35] hover:text-[#E63946] transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full h-11 pl-10 pr-10 rounded-lg text-sm text-[#0D1117] bg-slate-50 border transition-all duration-150 outline-none ${
                errors.password
                  ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-slate-200 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/20"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 font-medium pt-0.5">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center gap-2.5 pt-1">
          <input
            id="rememberMe"
            type="checkbox"
            checked={!!rememberMe}
            onChange={(e) => setValue("rememberMe", e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#FF6B35] focus:ring-[#FF6B35] cursor-pointer"
          />
          <label htmlFor="rememberMe" className="text-xs font-medium text-slate-600 cursor-pointer select-none">
            Keep me signed in on this browser
          </label>
        </div>

        {/* API Error Message */}
        {apiError && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #FF6B35 0%, #E63946 100%)",
          }}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Clean Footer Support Trigger */}
      <div className="mt-8 text-center pt-6 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Need assistance or onboarding help?{" "}
          <button
            type="button"
            onClick={() => toast.info("Support contact is coming soon — reach out to your account manager in the meantime")}
            className="font-semibold text-[#FF6B35] hover:underline"
          >
            Contact Dineiz Support
          </button>
        </p>
      </div>
    </div>
  );
}
