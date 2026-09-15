'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const CSV_TEMPLATE_HEADERS = 'name,phone,email,total_spend,total_orders,loyalty_points';
const CSV_SAMPLE_ROW = 'Ali Khan,+923001234567,ali@example.com,15000,6,120';

function downloadTemplate() {
  const content = [CSV_TEMPLATE_HEADERS, CSV_SAMPLE_ROW].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'customers_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Minimal quoted-CSV line splitter — handles embedded commas/quotes, unlike a plain split(',').
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

interface ParsedCustomer {
  name: string;
  phone?: string;
  email?: string;
  totalSpend?: number;
  totalOrders?: number;
  loyaltyPoints?: number;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ customer: any; error: string }>;
}

interface ImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportCustomersModal({ isOpen, onClose, onImported }: ImportCustomersModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedCustomer[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setSelectedFile(null);
    setRows([]);
    setParseError(null);
    setResult(null);
    setShowErrors(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setParseError('The file has no data rows.');
        setRows([]);
        return;
      }
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const nameIdx = headers.indexOf('name');
      const phoneIdx = headers.indexOf('phone');
      const emailIdx = headers.indexOf('email');
      const spendIdx = headers.indexOf('total_spend');
      const ordersIdx = headers.indexOf('total_orders');
      const pointsIdx = headers.indexOf('loyalty_points');

      if (nameIdx === -1) {
        setParseError('The CSV must have a "name" column.');
        setRows([]);
        return;
      }

      const num = (cells: string[], idx: number) => {
        if (idx < 0 || !cells[idx]) return undefined;
        const n = Number(cells[idx]);
        return isNaN(n) ? undefined : n;
      };

      const parsed: ParsedCustomer[] = lines
        .slice(1)
        .map((line) => {
          const cells = parseCsvLine(line);
          return {
            name: cells[nameIdx] || '',
            phone: phoneIdx >= 0 ? cells[phoneIdx] || undefined : undefined,
            email: emailIdx >= 0 ? cells[emailIdx] || undefined : undefined,
            totalSpend: num(cells, spendIdx),
            totalOrders: num(cells, ordersIdx),
            loyaltyPoints: num(cells, pointsIdx),
          };
        })
        .filter((r) => r.name);

      setParseError(parsed.length === 0 ? 'No valid rows found — every row needs a name.' : null);
      setRows(parsed);
    };
    reader.onerror = () => setParseError('Could not read that file.');
    reader.readAsText(file);
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    setSelectedFile(file);
    setResult(null);
    parseFile(file);
  };

  const handleUpload = async () => {
    if (!rows.length) return;
    setUploading(true);
    try {
      const res = await apiFetch<ImportResult>('/api/customers/import', {
        method: 'POST',
        body: JSON.stringify({ customers: rows }),
      });
      setResult(res);
      if (res.created > 0 || res.updated > 0) onImported();
    } catch (e: any) {
      setResult({ created: 0, updated: 0, errors: [{ customer: null, error: e?.message || 'Import failed' }] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Import Customers</h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV to create or update customer profiles in bulk.</p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0">
                <FileText size={16} className="text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">CSV Template</p>
                <p className="text-[10px] text-slate-400">name, phone, email, total_spend, total_orders, loyalty_points</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-primary border border-brand-primary/30 rounded-lg hover:bg-brand-primary/5 transition-colors shrink-0"
            >
              <Download size={13} /> Template
            </button>
          </div>

          {!result && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragging ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-300 bg-white hover:border-brand-primary/50 hover:bg-brand-primary/5'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="w-11 h-11 bg-brand-primary/10 rounded-full flex items-center justify-center mb-3">
                <UploadCloud size={20} className="text-brand-primary" />
              </div>
              {selectedFile ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <FileText size={14} className="text-brand-primary" />
                  {selectedFile.name}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="ml-1 p-0.5 text-slate-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-800 mb-1">Drop your CSV here or click to browse</p>
                  <p className="text-[11px] text-slate-400">Needs a "name" column — phone is required for deduplication</p>
                </>
              )}
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-medium px-3.5 py-2.5 rounded-lg border border-red-100">
              <AlertCircle size={14} /> {parseError}
            </div>
          )}

          {!result && rows.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Preview (first 5 of {rows.length} row{rows.length === 1 ? '' : 's'})
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">Phone</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-2 text-slate-700 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono">{r.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{r.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                {result.created > 0 && (
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold">{result.created} created</span>
                  </div>
                )}
                {result.updated > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 size={16} className="text-slate-400" />
                    <span className="text-xs font-bold">{result.updated} updated</span>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <AlertCircle size={16} className="text-amber-500" />
                    <span className="text-xs font-bold">{result.errors.length} failed</span>
                  </div>
                )}
                {result.created === 0 && result.updated === 0 && result.errors.length === 0 && (
                  <span className="text-xs text-slate-500">Nothing to import.</span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div>
                  <button onClick={() => setShowErrors(!showErrors)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                    {showErrors ? 'Hide' : 'Show'} error details
                  </button>
                  {showErrors && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <div key={i} className="text-[11px] bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg">
                          {err.customer?.name ? `${err.customer.name}: ` : ''}{err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5 shrink-0">
          {result ? (
            <>
              <button
                onClick={reset}
                className="h-9 px-4 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs shadow-xs"
              >
                Import Another File
              </button>
              <button
                onClick={handleClose}
                className="h-9 px-5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold rounded-lg shadow-xs transition-colors text-xs"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="h-9 px-4 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!rows.length || uploading}
                className="h-9 px-5 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center min-w-[150px] text-xs disabled:opacity-60 disabled:cursor-not-allowed gap-1.5"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                {uploading ? 'Importing…' : `Import ${rows.length || ''} Customer${rows.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
