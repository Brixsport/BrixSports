import PushNotificationDebugger from '@/components/notifications/PushNotificationDebugger';
import Link from 'next/link';
import { Send, ArrowRight, Bell, History, Settings } from 'lucide-react';

export default function NotificationsAdminPage() {
  return (
    <div className="min-h-screen bg-black p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl tracking-tight italic uppercase">
              Push Notifications
            </h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Manage and send notifications to your users
            </p>
          </div>
        </header>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/notifications/composer"
            className="group p-6 bg-primary/20 border border-primary/50 rounded-2xl hover:bg-primary/30 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Send size={24} />
              </div>
              <ArrowRight size={20} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="font-display italic uppercase text-lg mb-1">Composer</h3>
            <p className="text-xs text-white/60">Design and send customized notifications</p>
          </Link>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <History size={24} />
              </div>
            </div>
            <h3 className="font-display italic uppercase text-lg mb-1">History</h3>
            <p className="text-xs text-white/60">View sent notifications and analytics</p>
          </div>

          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                <Settings size={24} />
              </div>
            </div>
            <h3 className="font-display italic uppercase text-lg mb-1">Settings</h3>
            <p className="text-xs text-white/60">Configure VAPID keys and defaults</p>
          </div>
        </div>

        {/* Diagnostics */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="font-display italic uppercase tracking-tighter text-xl mb-6 flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            System Diagnostics
          </h2>
          <PushNotificationDebugger />
        </section>
      </div>
    </div>
  );
}
