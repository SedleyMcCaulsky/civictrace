'use client';
import { ShieldCheck } from 'lucide-react';
export default function CompliancePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6" /> Compliance Analytics
      </h1>
      <p className="text-slate-500 mt-2">Compliance reporting — coming in next build.</p>
    </div>
  );
}
