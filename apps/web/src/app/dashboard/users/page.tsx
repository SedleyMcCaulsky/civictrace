'use client';
import { Users } from 'lucide-react';
export default function UsersPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Users className="h-6 w-6" /> User Management
      </h1>
      <p className="text-slate-500 mt-2">User and role management — coming in next build.</p>
    </div>
  );
}
