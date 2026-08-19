"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export interface UserContextType {
  userId: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'BRANCH_MANAGER' | 'CASHIER';
  tenantId: string;
  branchId: string | null;
  tenant: { name: string; colorPrimary: string } | null;
  branch: { name: string } | null;
  image: string | null;
  avatarColor: string | null;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProviderWrapper({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, [router]);

  async function loadUser() {
      try {
        // Call the Better Auth session endpoint directly — returns full user with additionalFields
        const res = await fetch(`${API_URL}/api/auth/get-session`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        
        if (!data?.user) {
          router.push("/login");
          return;
        }

        const u = data.user;
        
        // If role isn't in the session (shouldn't happen after fix, but guard anyway)
        if (!u.role || u.role === 'CASHIER') {
          if (u.role === 'CASHIER') {
            // router.push() only handles internal routes — passing a full
            // external URL just navigated to a literal (and broken)
            // "/http://localhost:3001" path within the dashboard app instead
            // of actually sending POS staff to the POS app.
            window.location.href = process.env.NEXT_PUBLIC_POS_URL || "http://localhost:3001";
          } else {
            router.push("/login");
          }
          return;
        }

        setUser({
          userId: u.id,
          email: u.email,
          name: u.name,
          role: u.role as UserContextType['role'],
          tenantId: u.tenantId || "",
          branchId: u.branchId || null,
          tenant: u.tenant || null,
          branch: u.branch || null,
          image: u.image || null,
          avatarColor: u.avatarColor || null,
          refreshUser: loadUser,
        });
      } catch (err) {
        console.error("Failed to load user session:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProviderWrapper");
  }
  return context;
}
