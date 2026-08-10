import React from 'react';
import { Info } from 'lucide-react';

interface AllBranchesBannerProps {
  isAllBranches: boolean;
}

export function AllBranchesBanner({ isAllBranches }: AllBranchesBannerProps) {
  if (!isAllBranches) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-md w-fit mb-6 border border-slate-200 shadow-sm">
      <Info className="w-4 h-4 text-slate-400" />
      <span className="text-xs font-medium tracking-wide uppercase">
        Viewing All Branches
      </span>
    </div>
  );
}
