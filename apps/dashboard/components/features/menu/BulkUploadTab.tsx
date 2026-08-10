'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, Download, AlertCircle, X, Loader2 } from 'lucide-react';
import { menuApi } from '@/lib/api/menu';

const CSV_TEMPLATE_HEADERS = 'category_name,item_name,base_price,unit_type,description,is_available';
const CSV_SAMPLE_ROW = 'Burgers,Zinger Burger,650,Per Item,Crispy fried chicken with our signature sauce,true';

function downloadTemplate() {
  const content = [CSV_TEMPLATE_HEADERS, CSV_SAMPLE_ROW].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'menu_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface BulkUploadTabProps {
  onUploaded?: () => void;
}

interface UploadResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export function BulkUploadTab({ onUploaded }: BulkUploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorDetail, setErrorDetail] = useState(false);

  const parsePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split('\n').slice(0, 6); // header + 5 rows
      const rows = lines.map((l) => l.split(','));
      setPreviewHeaders(rows[0] || []);
      setPreviewRows(rows.slice(1));
    };
    reader.readAsText(file);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }
    setSelectedFile(file);
    setResult(null);
    parsePreview(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(10);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 300);

    try {
      const res = await menuApi.bulkUpload(selectedFile);
      setProgress(100);
      setResult(res);
      if (res.created > 0) onUploaded?.();
    } catch (err: any) {
      setResult({ created: 0, failed: 0, errors: [{ row: 0, message: err.message }] });
    } finally {
      clearInterval(interval);
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-black text-slate-900">Bulk Upload Menu</h2>
          <p className="text-xs text-slate-500 mt-1">
            Upload a CSV to create multiple menu items at once. Download the template to get started.
          </p>
        </div>

        {/* Download template */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">CSV Template</p>
              <p className="text-[10px] text-slate-400">
                Headers: category_name, item_name, base_price, unit_type, description, is_available
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Download size={13} /> Download Template
          </button>
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragging ? 'border-[#ff5722] bg-orange-50' : 'border-slate-300 bg-white hover:border-[#ff5722]/50 hover:bg-orange-50/30'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mb-3">
            <UploadCloud size={24} className="text-[#ff5722]" />
          </div>
          {selectedFile ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText size={16} className="text-[#ff5722]" />
              {selectedFile.name}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewRows([]); setResult(null); }}
                className="ml-1 p-0.5 text-slate-400 hover:text-red-500"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-800 mb-1">Drop your CSV here or click to browse</p>
              <p className="text-xs text-slate-400">CSV file (max 10MB)</p>
            </>
          )}
        </div>

        {/* Preview */}
        {previewRows.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Preview (first 5 rows)
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {previewHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Uploading...</span>
              <span className="text-xs text-slate-400">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ff5722] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload button */}
        {selectedFile && !uploading && !result && (
          <button
            onClick={handleUpload}
            className="w-full py-2.5 bg-[#ff5722] text-white text-sm font-bold rounded-xl hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <UploadCloud size={16} />
            Upload {selectedFile.name}
          </button>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-4">
              {result.created > 0 && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 size={20} className="text-green-500" />
                  <span className="text-sm font-bold">{result.created} items created</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle size={20} className="text-amber-500" />
                  <span className="text-sm font-bold">{result.failed} rows failed</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div>
                <button
                  onClick={() => setErrorDetail(!errorDetail)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  {errorDetail ? 'Hide' : 'Show'} error details ({result.errors.length})
                </button>
                {errorDetail && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-[10px] bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg">
                        {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { setSelectedFile(null); setPreviewRows([]); setResult(null); setProgress(0); }}
              className="w-full py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
