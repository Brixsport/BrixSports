'use client';

import { AdminSidebar } from './AdminSidebar';

export function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <AdminSidebar />
            <main className="transition-all duration-300 lg:pl-72">
                {children}
            </main>
        </div>
    );
}
