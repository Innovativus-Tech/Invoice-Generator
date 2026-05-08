'use client';

import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadInventoryCSV } from '@/hooks/use-inventory';

export function CsvUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCsv = useUploadInventoryCSV();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadCsv.mutateAsync(file);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        loading={isUploading}
        icon={<Upload className="h-4 w-4" />}
      >
        {isUploading ? 'Uploading...' : 'Upload CSV'}
      </Button>
    </div>
  );
}
