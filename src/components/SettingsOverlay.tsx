'use client';

import { motion } from 'framer-motion';
import { X, Bell, Shield, Eye, Smartphone, Zap, Check, BellOff, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getPushService } from '@/lib/notifications/push-service';
import { toast } from 'sonner';

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = useState({
    matchAlerts: true,
    playerRatings: true,
    scoutUpdates: false,
    eyePointMilestones: true,
  });

  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const pushService = getPushService();

  useEffect(() => {
    try {
      // Load local preferences as fallback
      const savedPrefs = localStorage.getItem('brixsport_preferences');
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }

      // Get user info
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser && parsedUser.id) {
          setUser(parsedUser);
          // Fetch from API
          fetchPreferences(parsedUser.id);
        }
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
    }

    // Check notification status
    checkPushStatus();
  }, []);

  const fetchPreferences = async (userId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/users/${userId}/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          const { matchAlerts, playerRatings, scoutUpdates, milestones } = data.preferences;
          setPreferences({
            matchAlerts: matchAlerts ?? true,
            playerRatings: playerRatings ?? true,
            scoutUpdates: scoutUpdates ?? false,
            eyePointMilestones: milestones ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  const checkPushStatus = async () => {
    try {
      await pushService.init();
      const permission = pushService.getPermission();
      setPushStatus(permission);

      if (permission === 'granted') {
        const subscribed = await pushService.isSubscribed();
        setIsSubscribed(subscribed);
      }
    } catch (error) {
      console.error('Error checking push status:', error);
    }
  };

  const handleEnablePush = async () => {
    if (!user) {
      toast.error('Please sign in to enable notifications');
      return;
    }

    setLoading(true);
    try {
      const permission = await pushService.requestPermission();
      setPushStatus(permission);

      if (permission === 'granted') {
        const sub = await pushService.subscribe(user.id);
        if (sub) {
          setIsSubscribed(true);
          toast.success('Push notifications enabled!');
        } else {
          toast.error('Failed to subscribe to push service');
        }
      } else if (permission === 'denied') {
        toast.error('Notifications are blocked by your browser');
      }
    } catch (error) {
      console.error('Error enabling push:', error);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const success = await pushService.unsubscribe(user.id);
      if (success) {
        setIsSubscribed(false);
        toast.success('Push notifications disabled');
      }
    } catch (error) {
      console.error('Error disabling push:', error);
      toast.error('Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      // 1. Save locally
      localStorage.setItem('brixsport_preferences', JSON.stringify(preferences));

      // 2. Sync to API if logged in
      if (user) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/users/${user.id}/preferences`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            matchAlerts: preferences.matchAlerts,
            playerRatings: preferences.playerRatings,
            scoutUpdates: preferences.scoutUpdates,
            milestones: preferences.eyePointMilestones,
          })
        });

        if (!response.ok) throw new Error('Failed to sync with server');
      }

      toast.success('Preferences saved!');
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Saved locally, but failed to sync to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full bg-white/5 border border-white/10 rounded-[48px] p-8 md:p-12 relative overflow-hidden"
      >
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

        {/* Push Notification Main Status */}
        <div className="mb-10 p-6 bg-white/5 border border-white/10 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${pushStatus === 'granted' && isSubscribed ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
                <Bell size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase italic">Browser Push</h4>
                <p className="text-[10px] text-white/40">System-level notifications for live events</p>
              </div>
            </div>

            {pushStatus === 'granted' && isSubscribed ? (
              <button
                onClick={handleDisablePush}
                disabled={loading}
                className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Disable'}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={loading}
                className="px-4 py-2 bg-primary text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Enable'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-xl border border-white/5">
            <div className={`w-2 h-2 rounded-full ${pushStatus === 'granted' && isSubscribed ? 'bg-green-500 animate-pulse' :
              pushStatus === 'denied' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">
              Status: {
                pushStatus === 'granted' && isSubscribed ? 'Active & Subscribed' :
                  pushStatus === 'granted' ? 'Permitted but Not Subscribed' :
                    pushStatus === 'denied' ? 'Blocked by Browser' : 'Ready to Enable'
              }
            </span>
          </div>
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
          onClick={savePreferences}
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
        <div className={`p-3 rounded-2xl border transition-all ${active ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/5 border-white/10 text-white/40'}`}>
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

