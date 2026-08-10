"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BrandingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/settings#branding");
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-primary text-3xl">palette</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Branding has moved</h2>
        <p className="text-sm text-gray-500 mb-5">
          Branding settings are now part of the main Settings page for a cleaner experience.
        </p>
        <button
          onClick={() => router.push("/dashboard/settings#branding")}
          className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all"
        >
          Go to Settings → Branding
        </button>
      </div>
    </div>
  );
}
