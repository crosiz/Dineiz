"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useUser } from "./user-context";

export interface PlanContextType {
  plan: any; // PlanDefinition
  overrides: any[]; // TenantFeatureOverride[]
  loading: boolean;
}

const PlanContext = createContext<PlanContextType>({
  plan: null,
  overrides: [],
  loading: true,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function PlanProviderWrapper({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ plan: any; overrides: any[] }>({ plan: null, overrides: [] });
  const [loading, setLoading] = useState(true);
  
  // Only fetch if user is logged in
  const { userId, tenantId } = useUser();

  useEffect(() => {
    if (!userId || !tenantId) return;

    let mounted = true;
    async function loadPlan() {
      try {
        const res = await fetch(`${API_URL}/api/tenants/current/plan`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok && mounted) {
          const json = await res.json();
          setData({ plan: json.plan, overrides: json.overrides });
        }
      } catch (err) {
        console.error("Failed to load plan:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPlan();
    return () => { mounted = false; };
  }, [userId, tenantId]);

  return (
    <PlanContext.Provider value={{ ...data, loading }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
