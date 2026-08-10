"use client";

import { AlertTriangle, Crown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePlanFeature } from "@/hooks/usePlanFeature";
import { useUser } from "@/contexts/user-context";
import { useEffect, useState } from "react";

export function PlanBanner() {
  const { planName, loading } = usePlanFeature();
  const { role } = useUser();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show to tenant admins on GO FREE or trials
    if (!loading && role === "TENANT_ADMIN") {
      if (planName?.toLowerCase().includes("free") || planName?.toLowerCase().includes("trial")) {
        setShow(true);
      }
    }
  }, [loading, planName, role]);

  if (!show) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-sm">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Crown className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <p className="text-slate-700 font-medium">
          You are currently on the <strong className="text-amber-700">{planName}</strong> plan. Upgrade to unlock all premium features and grow your business.
        </p>
      </div>
      <Link 
        href="/dashboard/settings/billing"
        className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span>View Plans</span>
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}
