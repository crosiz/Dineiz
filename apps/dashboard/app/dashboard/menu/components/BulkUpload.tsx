'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@swiftserve/ui/src/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@swiftserve/ui/src/components/card';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function BulkUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState<{ categories: number, items: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setErrorMessage('');
      setStats(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8080/api/menu/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          throw new Error(`Validation failed:\n${data.errors.join('\n')}`);
        }
        throw new Error(data.error || 'Failed to upload bulk menu data');
      }

      setStats({ categories: data.created, items: data.created }); // Backend just returns created (which is items)
      setStatus('success');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'An unknown error occurred');
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Bulk CSV Upload</CardTitle>
        <CardDescription>
          Upload a CSV file to quickly populate your menu. Required columns: Category Name, Item Name, Base Price.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div 
          className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <UploadCloud className="w-12 h-12 text-neutral-400 mb-4" />
          <h3 className="font-medium text-lg">Click to select CSV file</h3>
          <p className="text-sm text-neutral-500 mt-1">or drag and drop here</p>
        </div>

        {file && (
          <div className="flex items-center justify-between p-4 bg-neutral-100 dark:bg-neutral-800 rounded-md">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-primary-600" />
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <Button 
              onClick={processFile} 
              disabled={status === 'parsing' || status === 'uploading'}
            >
              {status === 'parsing' ? 'Parsing...' : status === 'uploading' ? 'Uploading...' : 'Process Upload'}
            </Button>
          </div>
        )}

        {status === 'success' && stats && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Upload Successful!</p>
              <p className="text-sm mt-1">Created {stats.categories} categories and {stats.items} items.</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Upload Failed</p>
              <p className="text-sm mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
