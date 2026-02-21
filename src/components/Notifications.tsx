'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Info, Star, Zap, Activity } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'match' | 'player' | 'info' | 'scout';
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif = { ...notif, id, timestamp: new Date() };
    setNotifications(prev => [newNotif, ...prev].slice(0, 5));

    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationToast notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

function NotificationToast({ notifications, onClose }: { notifications: Notification[], onClose: (id: string) => void }) {
  return (
    <div className="fixed bottom-8 right-8 z-[200] space-y-4 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.5 }}
            className="pointer-events-auto bg-black/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl w-80 flex items-start gap-4"
          >
            <div className={`p-2 rounded-xl ${notif.type === 'match' ? 'bg-primary/20 text-primary' :
                notif.type === 'player' ? 'bg-secondary/20 text-secondary' :
                  'bg-blue-500/20 text-blue-500'
              }`}>
              {notif.type === 'match' ? <Activity size={18} /> :
                notif.type === 'player' ? <Star size={18} /> :
                  notif.type === 'scout' ? <Zap size={18} /> : <Info size={18} />}
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black tracking-widest uppercase mb-1">{notif.title}</h4>
              <p className="text-[11px] text-white/60 leading-relaxed font-medium italic">{notif.message}</p>
            </div>
            <button
              onClick={() => onClose(notif.id)}
              className="text-white/20 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
