import React from 'react';
import { ChevronDown } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }: PaginationProps) {
  const pages: (number | '...')[] = [];
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <button
          className="px-2.5 py-1.5 rounded-lg text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
          disabled={currentPage === 1} 
          onClick={() => onPageChange(currentPage - 1)}
        >
          Prev
        </button>
        
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                currentPage === p 
                  ? 'bg-[#ff5722] text-white font-bold shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        
        <button
          className="px-2.5 py-1.5 rounded-lg text-slate-500 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
          disabled={currentPage >= totalPages || totalPages === 0} 
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>

      {pageSize !== undefined && onPageSizeChange && (
        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <span className="text-[13px] text-slate-500">Show:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 outline-none appearance-none cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
}
