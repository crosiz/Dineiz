"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@dineiz/ui";
import { useUser } from "@/contexts/user-context";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BranchSelect } from "@/components/ui/branch-select";
import { Sun, CloudSun, Moon } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function Header() {
  const { name, role, branch, tenant } = useUser();
  const isTenantAdmin = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Time-based greeting
  const [greeting, setGreeting] = useState("Good morning");
  const [icon, setIcon] = useState<React.ReactNode>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good morning");
      setIcon(<Sun size={16} className="text-slate-400" />);
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good afternoon");
      setIcon(<CloudSun size={16} className="text-slate-400" />);
    } else {
      setGreeting("Good evening");
      setIcon(<Moon size={16} className="text-slate-400" />);
    }
  }, []);

  // Branch Selection Logic
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  useEffect(() => {
    const saved = localStorage.getItem('selectedBranchId');
    const param = searchParams.get('branch');
    if (param) {
      setSelectedBranch(param);
      if (param !== saved) localStorage.setItem('selectedBranchId', param);
    } else if (saved) {
      setSelectedBranch(saved);
      // Auto-update URL if saved exists but missing from URL
      const params = new URLSearchParams(searchParams.toString());
      params.set('branch', saved);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedBranch(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val === "all") {
      params.delete('branch');
      localStorage.removeItem('selectedBranchId');
    } else {
      params.set('branch', val);
      localStorage.setItem('selectedBranchId', val);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="h-[72px] flex items-center justify-between px-6 lg:px-8 border-b border-border bg-surface-base shrink-0">
      <div className="flex items-center text-text-primary gap-4">
        <span className="text-[18px] font-semibold flex items-center gap-2">{icon} {greeting}, {name?.split(' ')[0] || 'User'}</span>
        {!isTenantAdmin && branch && (
          <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-full border border-brand-primary/20">
            {branch.name}
          </span>
        )}
      </div>

      {isTenantAdmin && (
        <div className="flex items-center w-[200px]">
          <BranchSelect
            value={selectedBranch === "all" ? null : selectedBranch}
            onChange={(val) => handleBranchChange({ target: { value: val || "all" } } as any)}
            includeAll={true}
            placeholder="All Branches"
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        {tenant && (
          <div className="hidden sm:flex items-center px-3 py-1 bg-surface-overlay border border-border rounded text-sm font-medium">
            {tenant.name}
          </div>
        )}
        <Button variant="outline" size="sm" onClick={async () => {
          await authClient.signOut();
          window.location.href = "/login";
        }}>
          Logout
        </Button>
      </div>
    </header>
  );
}
