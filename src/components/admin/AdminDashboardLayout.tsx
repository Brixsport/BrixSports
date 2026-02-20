'use client';

import { AdminSidebar } from './AdminSidebar';

export function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <AdminSidebar />
            <main className="lg:pl-72 transition-all duration-300">
                {children}
            </main>
        </div>
    );
}
