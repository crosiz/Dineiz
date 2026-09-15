'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  UploadCloud, FileText, CheckCircle2, Download, AlertCircle, X, Loader2, ChevronDown, ChevronRight, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { menuApi, BulkUploadResult } from '@/lib/api/menu';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { MENU_CSV_COLUMNS, MENU_CSV_COLUMN_DOCS, TEMPLATE_URL, downloadCsv } from './menuCsv';

interface BulkUploadTabProps {
  onUploaded?: () => void;
}

const PREVIEW_ROWS = 8;

export function BulkUploadTab({ onUploaded }: BulkUploadTabProps) {
  const { selectedBranchId, selectedBranchName } = useDashboardContext();
  const isReadOnly = !selectedBranchId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [resultErrorsOpen, setResultErrorsOpen] = useState(true);
  const [upsert, setUpsert] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const reset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    setResult(null);
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please choose a .csv file');
      return;
    }
    reset();
    setSelectedFile(file);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (res.errors?.length) {
          setParseError(res.errors[0].message);
          setParsedRows([]);
          return;
        }
        setParsedRows(res.data as Record<string, string>[]);
      },
      error: (err) => setParseError(err.message),
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || isReadOnly) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await menuApi.bulkUpload(selectedFile, {
        branchId: selectedBranchId,
        mode: upsert ? 'upsert' : 'insert',
      });
      setResult(res);
      if (res.created || res.updated) onUploaded?.();
      if (!res.failed) toast.success(`Imported ${res.created + res.updated} item${res.created + res.updated !== 1 ? 's' : ''}`);
    } catch (err: any) {
      const rowErrors = Array.isArray(err.rowErrors) ? err.rowErrors : [{ row: 0, message: err.message }];
      setResult({ created: 0, updated: 0, skipped: 0, failed: rowErrors.length, errors: rowErrors });
    } finally {
      setUploading(false);
    }
  };

  const downloadFailedRows = () => {
    if (!result?.errors?.length || !parsedRows.length) return;
    const failed = result.errors
      .map((e) => {
        const row = parsedRows[e.row - 2];
        return row ? { ...row, _error: e.message } : null;
      })
      .filter(Boolean) as Record<string, string>[];
    if (!failed.length) return;
    const csv = Papa.unparse({ fields: [...MENU_CSV_COLUMNS, '_error'], data: failed });
    downloadCsv('menu-import-failed-rows.csv', csv);
  };

  const previewHeaders = MENU_CSV_COLUMNS.filter((h) => parsedRows.some((r) => r[h] != null && r[h] !== ''));

  return (
    <div className="flex-1 flex flex-col bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bulk import</h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload a CSV to add or update many items at once. Download the template to see the exact format.
          </p>
        </div>

        {/* Target branch */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isReadOnly ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}>
          <MapPin size={15} className={isReadOnly ? 'text-amber-500' : 'text-slate-400'} />
          {isReadOnly
            ? 'Select a specific branch (top-right) before importing — items are added to one branch.'
            : <>Items will be imported into <span className="font-medium text-slate-800">{selectedBranchName}</span>.</>}
        </div>

        {/* Template + format guide */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                <FileText size={17} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">menu-bulk-upload-template.csv</p>
                <p className="text-xs text-slate-400">10 columns · 5 example rows · covers categories, variations, add-ons, tags</p>
              </div>
            </div>
            <a
              href={TEMPLATE_URL}
              download
              className="flex items-center gap-1.5 px-3 h-9 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download size={14} /> Template
            </a>
          </div>

          <button
            onClick={() => setGuideOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-4 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {guideOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Column reference
          </button>
          {guideOpen && (
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-400">
                    <th className="px-4 py-2 font-semibold">Column</th>
                    <th className="px-3 py-2 font-semibold">Required</th>
                    <th className="px-3 py-2 font-semibold">Example</th>
                    <th className="px-3 py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {MENU_CSV_COLUMN_DOCS.map((c) => (
                    <tr key={c.name} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2 font-mono text-slate-700 whitespace-nowrap">{c.name}</td>
                      <td className="px-3 py-2">
                        {c.required ? <span className="text-[#ff5722] font-semibold">Yes</span> : <span className="text-slate-400">No</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{c.example || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
            isReadOnly
              ? 'border-slate-200 bg-slate-100/60 cursor-not-allowed opacity-70'
              : dragging
                ? 'border-[#ff5722] bg-orange-50 cursor-pointer'
                : 'border-slate-300 bg-white hover:border-[#ff5722]/50 cursor-pointer'
          }`}
          onClick={() => !isReadOnly && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!isReadOnly) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (isReadOnly) return;
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
          <div className="w-11 h-11 bg-orange-50 rounded-full flex items-center justify-center mb-3">
            <UploadCloud size={22} className="text-[#ff5722]" />
          </div>
          {selectedFile ? (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <FileText size={15} className="text-[#ff5722]" />
              {selectedFile.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="ml-1 p-0.5 text-slate-400 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-800">Drop your CSV here, or click to browse</p>
              <p className="text-xs text-slate-400 mt-0.5">CSV file, up to 5MB</p>
            </>
          )}
        </div>

        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            Couldn't read that file: {parseError}
          </div>
        )}

        {/* Preview */}
        {parsedRows.length > 0 && !result && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Preview — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''}, showing first {Math.min(PREVIEW_ROWS, parsedRows.length)}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="text-xs w-full whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-left text-slate-400">
                    {previewHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      {previewHeaders.map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-600 max-w-[220px] truncate">
                          {(h === 'variations' || h === 'add_ons' || h === 'tags') && row[h]
                            ? <span className="flex flex-wrap gap-1">
                                {row[h].split(';').filter(Boolean).map((t, k) => (
                                  <span key={k} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{t}</span>
                                ))}
                              </span>
                            : row[h] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Options + action */}
        {selectedFile && !result && (
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-sm text-slate-600 select-none">
              <input
                type="checkbox"
                checked={upsert}
                onChange={(e) => setUpsert(e.target.checked)}
                className="w-4 h-4 rounded accent-[#ff5722]"
              />
              Update items that already exist (match by name within a category). Off = skip duplicates.
            </label>
            <button
              onClick={handleUpload}
              disabled={uploading || isReadOnly || !!parseError || parsedRows.length === 0}
              className="w-full h-11 bg-[#ff5722] text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {uploading ? 'Importing…' : `Import ${parsedRows.length} row${parsedRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Stat icon={<CheckCircle2 size={18} className="text-green-500" />} label="added" value={result.created} strong />
              <Stat label="updated" value={result.updated} />
              <Stat label="skipped" value={result.skipped} />
              <Stat icon={result.failed ? <AlertCircle size={18} className="text-amber-500" /> : undefined} label="failed" value={result.failed} tone={result.failed ? 'amber' : undefined} />
            </div>

            {result.errors.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setResultErrorsOpen((v) => !v)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    {resultErrorsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} not imported
                  </button>
                  {parsedRows.length > 0 && (
                    <button onClick={downloadFailedRows} className="text-xs font-medium text-[#ff5722] hover:underline flex items-center gap-1">
                      <Download size={12} /> Download failed rows
                    </button>
                  )}
                </div>
                {resultErrorsOpen && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-xs bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg">
                        {err.row > 0 ? <span className="font-semibold">Row {err.row}: </span> : null}{err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={reset}
              className="w-full h-10 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Import another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  strong,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  strong?: boolean;
  tone?: 'amber';
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className={`font-semibold tabular-nums ${tone === 'amber' ? 'text-amber-700' : strong ? 'text-green-700' : 'text-slate-700'}`}>
        {value}
      </span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
