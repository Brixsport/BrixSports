'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, User, Bell, Lock, Globe, Palette, Eye, Shield,
    Mail, Smartphone, Moon, Sun, Volume2, VolumeX, Save, ChevronRight, Loader2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { setTheme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const [settings, setSettings] = useState({
        // Account
        name: '',
        email: '',
        phone: '',

        // Preferences
        theme: 'dark',
        language: 'en',
        timezone: 'Africa/Lagos',
        defaultView: 'standings',

        // Notifications
        emailNotifications: true,
        pushNotifications: true,
        matchReminders: true,
        favoriteTeamUpdates: true,
        weeklyDigest: false,

        // Privacy
        profileVisibility: 'public',
        showStats: true,
        showActivity: true,

        // Display
        soundEffects: true,
        animations: true,
        compactMode: false,
    });

    // Load user data and preferences
    useEffect(() => {
        const loadSettings = async () => {
            if (!user?.id) return;

            try {
                setLoading(true);

                // Fetch user data
                const userResponse = await fetch(`/api/users/${user.id}`);
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    setSettings(prev => ({
                        ...prev,
                        name: userData.user.name || '',
                        email: userData.user.email || '',
                    }));
                }

                // Fetch user preferences
                const prefsResponse = await fetch(`/api/users/${user.id}/preferences`);
                if (prefsResponse.ok) {
                    const prefsData = await prefsResponse.json();
                    if (prefsData.preferences) {
                        // Sync the saved DB preference into next-themes so a signed-in
                        // user's own choice actually applies live, not just locally in
                        // this settings form -- localStorage (next-themes' own default
                        // persistence) already covers same-browser return visits; this
                        // covers a signed-in user's preference following them across
                        // devices/browsers once they load this page.
                        setTheme(prefsData.preferences.theme || 'dark');
                        setSettings(prev => ({
                            ...prev,
                            theme: prefsData.preferences.theme || 'dark',
                            language: prefsData.preferences.language || 'en',
                            timezone: prefsData.preferences.timezone || 'Africa/Lagos',
                            defaultView: prefsData.preferences.defaultView || 'standings',
                            emailNotifications: prefsData.preferences.emailNotifications ?? true,
                            pushNotifications: prefsData.preferences.notifications ?? true,
                            matchReminders: prefsData.preferences.matchReminders ?? true,
                            favoriteTeamUpdates: prefsData.preferences.favoriteTeamUpdates ?? true,
                            weeklyDigest: prefsData.preferences.weeklyDigest ?? false,
                            profileVisibility: prefsData.preferences.profileVisibility || 'public',
                            showStats: prefsData.preferences.showStats ?? true,
                            showActivity: prefsData.preferences.showActivity ?? true,
                            soundEffects: prefsData.preferences.soundEffects ?? true,
                            animations: prefsData.preferences.animations ?? true,
                            compactMode: prefsData.preferences.compactMode ?? false,
                        }));
                    }
                }
            } catch (error) {
                console.error('Error loading settings:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [user]);

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!user?.id) {
            toast.error('You must be logged in to save settings');
            return;
        }

        try {
            setSaving(true);

            // Update user profile
            const profileResponse = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: settings.name,
                }),
            });

            if (!profileResponse.ok) {
                throw new Error('Failed to update profile');
            }

            // Update user preferences
            const prefsResponse = await fetch(`/api/users/${user.id}/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    theme: settings.theme,
                    language: settings.language,
                    timezone: settings.timezone,
                    defaultView: settings.defaultView,
                    notifications: settings.pushNotifications,
                    emailNotifications: settings.emailNotifications,
                    matchReminders: settings.matchReminders,
                    favoriteTeamUpdates: settings.favoriteTeamUpdates,
                    weeklyDigest: settings.weeklyDigest,
                    profileVisibility: settings.profileVisibility,
                    showStats: settings.showStats,
                    showActivity: settings.showActivity,
                    soundEffects: settings.soundEffects,
                    animations: settings.animations,
                    compactMode: settings.compactMode,
                }),
            });

            if (!prefsResponse.ok) {
                throw new Error('Failed to update preferences');
            }

            toast.success('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
            {/* ... (Header and other sections remain the same) */}

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Settings size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Preferences</span>
                    </div>
                    <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Settings</h1>
                </div>

                {/* Settings Sections */}
                <div className="space-y-6">
                    {/* Account Settings */}
                    <SettingsSection
                        icon={<User size={20} />}
                        title="Account"
                        description="Manage your account information"
                    >
                        <SettingRow label="Full Name">
                            <input
                                type="text"
                                value={settings.name}
                                onChange={(e) => updateSetting('name', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all w-full max-w-xs"
                            />
                        </SettingRow>
                        <SettingRow label="Email Address">
                            <input
                                type="email"
                                value={settings.email}
                                disabled
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none opacity-50 cursor-not-allowed w-full max-w-xs"
                                title="Email cannot be changed"
                            />
                        </SettingRow>
                    </SettingsSection>

                    {/* Appearance */}
                    <SettingsSection
                        icon={<Palette size={20} />}
                        title="Appearance"
                        description="Customize how Brix looks"
                    >
                        <SettingRow label="Theme">
                            <div className="flex gap-2">
                                <ThemeButton
                                    icon={<Moon size={16} />}
                                    label="Dark"
                                    active={settings.theme === 'dark'}
                                    onClick={() => { setTheme('dark'); updateSetting('theme', 'dark'); }}
                                />
                                <ThemeButton
                                    icon={<Sun size={16} />}
                                    label="Light"
                                    active={settings.theme === 'light'}
                                    onClick={() => { setTheme('light'); updateSetting('theme', 'light'); }}
                                />
                            </div>
                        </SettingRow>
                        <SettingRow label="Sound Effects">
                            <Toggle
                                enabled={settings.soundEffects}
                                onChange={(val) => updateSetting('soundEffects', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Animations">
                            <Toggle
                                enabled={settings.animations}
                                onChange={(val) => updateSetting('animations', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Compact Mode">
                            <Toggle
                                enabled={settings.compactMode}
                                onChange={(val) => updateSetting('compactMode', val)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    {/* Preferences */}
                    <SettingsSection
                        icon={<Globe size={20} />}
                        title="Preferences"
                        description="Set your default preferences"
                    >
                        <SettingRow label="Language">
                            <select
                                value={settings.language}
                                onChange={(e) => updateSetting('language', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="es">Español</option>
                            </select>
                        </SettingRow>
                        <SettingRow label="Timezone">
                            <select
                                value={settings.timezone}
                                onChange={(e) => updateSetting('timezone', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="Africa/Lagos">Lagos (GMT+1)</option>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">New York (EST)</option>
                                <option value="Europe/London">London (GMT)</option>
                                <option value="Asia/Tokyo">Tokyo (JST)</option>
                            </select>
                        </SettingRow>
                        <SettingRow label="Default View">
                            <select
                                value={settings.defaultView}
                                onChange={(e) => updateSetting('defaultView', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="standings">Standings</option>
                                <option value="brackets">Brackets</option>
                                <option value="matches">Matches</option>
                                <option value="lineups">Lineups</option>
                            </select>
                        </SettingRow>
                    </SettingsSection>

                    {/* Notifications */}
                    <SettingsSection
                        icon={<Bell size={20} />}
                        title="Notifications"
                        description="Control what notifications you receive"
                    >
                        <SettingRow label="Email Notifications">
                            <Toggle
                                enabled={settings.emailNotifications}
                                onChange={(val) => updateSetting('emailNotifications', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Push Notifications">
                            <Toggle
                                enabled={settings.pushNotifications}
                                onChange={(val) => updateSetting('pushNotifications', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Match Reminders">
                            <Toggle
                                enabled={settings.matchReminders}
                                onChange={(val) => updateSetting('matchReminders', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Favorite Team Updates">
                            <Toggle
                                enabled={settings.favoriteTeamUpdates}
                                onChange={(val) => updateSetting('favoriteTeamUpdates', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Weekly Digest">
                            <Toggle
                                enabled={settings.weeklyDigest}
                                onChange={(val) => updateSetting('weeklyDigest', val)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    {/* Privacy */}
                    <SettingsSection
                        id="privacy"
                        icon={<Shield size={20} />}
                        title="Privacy & Security"
                        description="Manage your privacy settings"
                    >
                        <SettingRow label="Profile Visibility">
                            <select
                                value={settings.profileVisibility}
                                onChange={(e) => updateSetting('profileVisibility', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="public">Public</option>
                                <option value="friends">Friends Only</option>
                                <option value="private">Private</option>
                            </select>
                        </SettingRow>
                        <SettingRow label="Show Statistics">
                            <Toggle
                                enabled={settings.showStats}
                                onChange={(val) => updateSetting('showStats', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Show Activity">
                            <Toggle
                                enabled={settings.showActivity}
                                onChange={(val) => updateSetting('showActivity', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Change Password">
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold flex items-center gap-2"
                            >
                                <Lock size={14} />
                                Update
                            </button>
                        </SettingRow>
                    </SettingsSection>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-4 bg-primary text-black rounded-2xl hover:scale-105 transition-all flex items-center gap-2 font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
            )}
        </div>
    );
}

function SettingsSection({ id, icon, title, description, children }: {
    id?: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    // ... (implementation remains same)
    return (
        <div id={id} className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8 scroll-mt-24">
            <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                    {icon}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-display italic uppercase tracking-tight mb-1">{title}</h2>
                    <p className="text-sm text-white/60">{description}</p>
                </div>
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
    // ... (implementation remains same)
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
            <span className="text-sm font-bold text-white/80">{label}</span>
            <div>{children}</div>
        </div>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
    // ... (implementation remains same)
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`relative w-14 h-8 rounded-full transition-all ${enabled ? 'bg-primary' : 'bg-white/10'
                }`}
        >
            <motion.div
                animate={{ x: enabled ? 26 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
            />
        </button>
    );
}

function ThemeButton({ icon, label, active, onClick }: {
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    // ... (implementation remains same)
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${active
                ? 'bg-primary text-black'
                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                }`}
        >
            {icon}
            <span className="text-sm font-bold">{label}</span>
        </button>
    );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('New password must be at least 6 characters');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password');
            }

            toast.success('Password updated successfully');
            onClose();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#050505] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6"
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-display uppercase tracking-tight">Change Password</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white">
                        <VolumeX className="w-5 h-5" style={{ transform: 'rotate(45deg)' }} /> {/* Using VolumeX as generic close icon - or check imports */}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Enter current password"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Enter new password"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Confirm new password"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-primary text-black hover:bg-primary/90 text-sm font-bold transition-all disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}


