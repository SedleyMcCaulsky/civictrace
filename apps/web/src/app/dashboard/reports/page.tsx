'use client';
import { BarChart3 } from 'lucide-react';
export default function ReportsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 className="h-6 w-6" /> Reports
      </h1>
      <p className="text-slate-500 mt-2">Report generation — coming in next build.</p>
    </div>
  );
}
