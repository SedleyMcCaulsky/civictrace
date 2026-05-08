'use client';
import { Truck } from 'lucide-react';
export default function DeliveryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Truck className="h-6 w-6" /> Delivery Operations
      </h1>
      <p className="text-slate-500 mt-2">Field delivery tracking — coming in next build.</p>
    </div>
  );
}
