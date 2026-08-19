"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { DineizLogo } from "@/components/ui/DineizLogo";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: resetError } = await authClient.resetPassword({ newPassword, token });
      if (resetError) {
        setError(resetError.message ?? "This reset link is invalid or has expired.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="flex justify-center mb-8">
        <DineizLogo size="md" variant="light" />
      </div>

      <div className="mb-8 text-center">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-[#0D1117] tracking-tight mb-2">
          {done ? "Password updated" : "Set a new password"}
        </h2>
        <p className="text-sm text-slate-500 font-normal leading-relaxed">
          {done ? "You can now sign in with your new password." : "Choose a new password for your account."}
        </p>
      </div>

      {done ? (
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-150 shadow-md hover:shadow-lg active:scale-[0.99]"
          style={{ background: "linear-gradient(135deg, #FF6B35 0%, #E63946 100%)" }}
        >
          Go to sign in
        </button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-lg text-sm text-[#0D1117] bg-slate-50 border border-slate-200 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/20 transition-all duration-150 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 rounded-lg text-sm text-[#0D1117] bg-slate-50 border border-slate-200 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/20 transition-all duration-150 outline-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FF6B35 0%, #E63946 100%)" }}
          >
            {isLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
