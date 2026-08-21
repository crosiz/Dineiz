"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";

export default function BrandingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings#branding");
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="text-center p-8 max-w-md bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="w-12 h-12 bg-[#FF5722]/10 rounded-xl flex items-center justify-center mx-auto mb-3 text-[#FF5722]">
          <Palette size={24} />
        </div>
        <h2 className="text-sm font-bold text-slate-900 mb-1">Branding Settings Moved</h2>
        <p className="text-xs text-slate-500 mb-4">
          Branding settings are now unified in the main Organization Settings panel.
        </p>
        <button
          onClick={() => router.push("/dashboard/settings#branding")}
          className="h-9 px-4 bg-[#FF5722] hover:bg-[#F4511E] text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
        >
          Go to Settings → Branding
        </button>
      </div>
    </div>
  );
}

