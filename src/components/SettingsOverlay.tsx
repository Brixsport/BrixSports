'use client';

import { motion } from 'framer-motion';
import { X, Bell, Shield, Eye, Smartphone, Zap } from 'lucide-react';
import { useState } from 'react';

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = useState({
    matchAlerts: true,
    playerRatings: true,
    scoutUpdates: false,
    eyePointMilestones: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4"
    >
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-[48px] p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
           <Bell size={200} />
        </div>

        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="font-display italic uppercase text-4xl tracking-tighter mb-2">Preferences</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Customize your Brixsport experience</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <PreferenceToggle 
            icon={<Bell size={18} />}
            title="Match Alerts"
            description="Live scores and event notifications for followed teams"
            active={preferences.matchAlerts}
            onToggle={() => setPreferences(p => ({ ...p, matchAlerts: !p.matchAlerts }))}
          />
          <PreferenceToggle 
            icon={<Zap size={18} />}
            title="Player Ratings"
            description="Real-time performance alerts for favorite players"
            active={preferences.playerRatings}
            onToggle={() => setPreferences(p => ({ ...p, playerRatings: !p.playerRatings }))}
          />
          <PreferenceToggle 
            icon={<Eye size={18} />}
            title="Eye Point Milestones"
            description="Get notified when players hit significant Eye Point levels"
            active={preferences.eyePointMilestones}
            onToggle={() => setPreferences(p => ({ ...p, eyePointMilestones: !p.eyePointMilestones }))}
          />
          <PreferenceToggle 
            icon={<Smartphone size={18} />}
            title="Recruiter Modes"
            description="Enable deep scout notifications (Recruiter License required)"
            active={preferences.scoutUpdates}
            onToggle={() => setPreferences(p => ({ ...p, scoutUpdates: !p.scoutUpdates }))}
          />
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-10 bg-primary text-black font-black uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Save Configuration
        </button>
      </div>
    </motion.div>
  );
}

function PreferenceToggle({ icon, title, description, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between gap-6 group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl border transition-all ${active ? 'bg-primary/10 border-primary/20 text-primaryScale' : 'bg-white/5 border-white/10 text-white/40'}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase italic">{title}</h4>
          <p className="text-[10px] text-white/40 leading-relaxed max-w-[200px]">{description}</p>
        </div>
      </div>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-all ${active ? 'bg-primary' : 'bg-white/10'}`}
      >
        <motion.div 
          animate={{ x: active ? 26 : 4 }}
          className={`absolute top-1 w-4 h-4 rounded-full ${active ? 'bg-black' : 'bg-white/40'}`}
        />
      </button>
    </div>
  );
}
