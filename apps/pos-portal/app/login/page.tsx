"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kababjees.pk");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/sign-in/email", { email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? "Invalid email or password" : "Couldn't reach the server — is pos-portal-api running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-6 rounded-lg border border-border bg-bg p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={36} />
          <div>
            <h1 className="text-lg font-bold text-text-1">Dineiz Portal</h1>
            <p className="text-[13px] text-text-2">Sign in to manage your restaurant</p>
          </div>
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-2">Email</span>
            <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-3 focus-within:border-primary">
              <Mail className="h-4 w-4 shrink-0 text-text-3" strokeWidth={1.75} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="w-full text-sm text-text-1 outline-none placeholder:text-text-3"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-2">Password</span>
            <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-3 focus-within:border-primary">
              <Lock className="h-4 w-4 shrink-0 text-text-3" strokeWidth={1.75} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm text-text-1 outline-none placeholder:text-text-3"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="shrink-0 text-text-3 hover:text-text-2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
              </button>
            </div>
          </label>

          <div className="flex justify-end">
            <button type="button" className="text-xs font-semibold text-primary">
              Forgot password?
            </button>
          </div>

          {error && (
            <div className="rounded-md border border-danger-border bg-danger-tint px-3 py-2 text-[13px] text-danger">{error}</div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <Link href="/onboarding" className="text-center text-xs font-semibold text-primary">
          First time here? Set up your branch
        </Link>

        <p className="text-center text-[11px] text-text-3">Dineiz POS Portal — design preview build</p>
      </div>
    </div>
  );
}
