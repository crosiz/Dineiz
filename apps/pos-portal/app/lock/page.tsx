"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api-client";

type Me = { id: string; name: string; avatarBg: string | null; avatarFg: string | null };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function LockScreenPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api
      .get<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => router.push("/login"));
  }, [router]);

  async function press(key: string) {
    if (checking) return;
    if (error) setError(null);
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "" || pin.length >= 4 || !me) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      try {
        await api.post("/api/auth/pin-login", { userId: me.id, pin: next });
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't reach the server");
        setPin("");
      } finally {
        setChecking(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "#E9EDF3" }}>
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: "rgba(255,255,255,0.85)" }}
      >
        {me && (
          <>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: me.avatarBg ?? "#B7C6EF", color: me.avatarFg ?? "#1B2C63" }}
            >
              {me.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <span className="text-[13px] font-semibold text-text-1">{me.name}</span>
          </>
        )}

        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full border-[1.5px] transition-colors",
                error ? "border-danger bg-danger" : i < pin.length ? "border-primary bg-primary" : "border-border bg-transparent"
              )}
            />
          ))}
        </div>
        {error && <span className="text-xs font-medium text-danger">{error}</span>}

        <div className="mt-2 grid grid-cols-3 gap-2.5">
          {KEYS.map((key, i) =>
            key === "" ? (
              <span key={i} className="h-14 w-14" />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={!me || checking}
                className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#F3F4F6] text-lg font-semibold text-text-1 transition-colors hover:bg-[#E9EAEC] disabled:opacity-50"
                aria-label={key === "del" ? "Delete" : key}
              >
                {key === "del" ? <Delete className="h-5 w-5" strokeWidth={1.75} /> : key}
              </button>
            )
          )}
        </div>

        <Link href="/login" className="mt-2 text-xs font-semibold text-primary">
          Switch user
        </Link>
      </div>
    </div>
  );
}
