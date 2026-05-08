'use client';
import { Scale } from 'lucide-react';
export default function AuditPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Scale className="h-6 w-6" /> Audit Logs
      </h1>
      <p className="text-slate-500 mt-2">Immutable audit trail — coming in next build.</p>
    </div>
  );
}
