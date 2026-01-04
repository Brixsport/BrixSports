'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, User, Bell, Lock, Globe, Palette, Eye, Shield,
    Mail, Smartphone, Moon, Sun, Volume2, VolumeX, Save, ChevronRight, Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                        setSettings(prev => ({
                            ...prev,
                            theme: prefsData.preferences.theme || 'dark',
                            language: prefsData.preferences.language || 'en',
                            timezone: prefsData.preferences.timezone || 'Africa/Lagos',
                            defaultView: prefsData.preferences.defaultView || 'standings',
                            emailNotifications: prefsData.preferences.emailNotifications ?? true,
                            pushNotifications: prefsData.preferences.notifications ?? true,
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

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-white/60">Loading settings...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <p className="text-white/60">Please sign in to access settings</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
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
                                    onClick={() => updateSetting('theme', 'dark')}
                                />
                                <ThemeButton
                                    icon={<Sun size={16} />}
                                    label="Light"
                                    active={settings.theme === 'light'}
                                    onClick={() => updateSetting('theme', 'light')}
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
                            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold flex items-center gap-2">
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
        </div>
    );
}

function SettingsSection({ icon, title, description, children }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-6 md:p-8">
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
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
            <span className="text-sm font-bold text-white/80">{label}</span>
            <div>{children}</div>
        </div>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
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
