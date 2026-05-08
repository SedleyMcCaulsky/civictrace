'use client';
import { FileText } from 'lucide-react';
export default function CasesPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <FileText className="h-6 w-6" /> Case Registry
      </h1>
      <p className="text-slate-500 mt-2">Property case management — coming in next build.</p>
    </div>
  );
}
