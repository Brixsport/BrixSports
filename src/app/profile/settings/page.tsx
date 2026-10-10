'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Settings, User, Bell, Lock, Globe, Palette, Eye, Shield,
    Mail, Smartphone, Moon, Sun, Volume2, VolumeX, Check, ChevronRight, Loader2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getClientErrorMessage } from '@/lib/client-error';
import { BackButton } from '@/components/ui/BackButton';

export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { setTheme } = useTheme();
    const [loading, setLoading] = useState(true);

    // Auto-save bookkeeping. `confirmed` holds the last server-accepted value per
    // key (the rollback target on failure); `saveSeq` lets a stale failure skip its
    // rollback when a newer change to the same key has since been made.
    const confirmed = useRef<Record<string, unknown>>({});
    const saveSeq = useRef<Record<string, number>>({});
    const loadedName = useRef('');
    const [pending, setPending] = useState(0);
    const [lastResult, setLastResult] = useState<'saved' | 'error' | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);

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
        pushNotifications: true,
        // BUG (session 51 audit): this page's toggle used to write matchReminders --
        // a column nothing ever reads (and confusingly named after the *unrelated*
        // per-match matchReminders table). The real send paths
        // (match-notification-service.ts, notifications/send/route.ts) gate on
        // userPreferences.matchAlerts. matchAlerts is now the source of truth here.
        matchAlerts: true,
        // BACKSCOPED session 51: no backing system anywhere (no email pipeline, no
        // per-team filtering, no digest job) -- UI hidden below, not deleted. State
        // kept so the fields still round-trip if the UI is ever reinstated.
        emailNotifications: true,
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
                    loadedName.current = userData.user.name || '';
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
                            pushNotifications: prefsData.preferences.notifications ?? true,
                            matchAlerts: prefsData.preferences.matchAlerts ?? true,
                            emailNotifications: prefsData.preferences.emailNotifications ?? true,
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

    // Local settings key -> preferences API field, where they differ.
    const PREF_API_KEY: Record<string, string> = { pushNotifications: 'notifications' };

    // Each control saves only its own field. The old Save button sent every field
    // at once, so a slow or failed initial load could overwrite real stored
    // preferences with this form's defaults; a single-field PATCH cannot.
    const saveField = async (key: string, value: unknown) => {
        if (!user?.id) {
            toast.error('You must be logged in to save settings');
            return;
        }
        if (!(key in confirmed.current)) {
            confirmed.current[key] = (settings as Record<string, unknown>)[key];
        }
        const seq = (saveSeq.current[key] = (saveSeq.current[key] ?? 0) + 1);
        setPending(n => n + 1);
        try {
            const res = await fetch(`/api/users/${user.id}/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [PREF_API_KEY[key] ?? key]: value }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            confirmed.current[key] = value;
            setLastResult('saved');
        } catch (error) {
            console.error(`Error saving setting "${key}":`, error);
            if (saveSeq.current[key] === seq) {
                setSettings(prev => ({ ...prev, [key]: confirmed.current[key] }));
                if (key === 'theme') setTheme(String(confirmed.current[key]));
            }
            setLastResult('error');
            toast.error("Couldn't save that change, so it was reverted");
        } finally {
            setPending(n => n - 1);
        }
    };

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        // Name is a free-text field: committed on blur (commitName), not per keystroke.
        if (key !== 'name') void saveField(key, value);
    };

    const commitName = async () => {
        const trimmed = settings.name.trim();
        if (trimmed === loadedName.current) {
            setNameError(null);
            return;
        }
        if (trimmed.length < 2 || trimmed.length > 100) {
            setNameError('Name must be 2 to 100 characters');
            return;
        }
        if (!user?.id) {
            toast.error('You must be logged in to save settings');
            return;
        }
        setNameError(null);
        setPending(n => n + 1);
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadedName.current = trimmed;
            setSettings(prev => ({ ...prev, name: trimmed }));
            setLastResult('saved');
        } catch (error) {
            console.error('Error saving name:', error);
            setSettings(prev => ({ ...prev, name: loadedName.current }));
            setLastResult('error');
            toast.error("Couldn't save your name, so it was reverted");
        } finally {
            setPending(n => n - 1);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6 md:p-12">
            {/* ... (Header and other sections remain the same) */}

            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Settings size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Preferences</span>
                        <SaveStatus pending={pending} lastResult={lastResult} />
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton fallbackHref="/profile" forceShow />
                        <h1 className="font-display text-5xl tracking-tighter italic uppercase leading-none">Settings</h1>
                    </div>
                </div>

                {/* Settings Sections */}
                <div className="space-y-6">
                    {/* Account Settings */}
                    <SettingsSection
                        icon={<User size={20} />}
                        title="Account"
                        description="Manage your account information"
                    >
                        <SettingRow label="Full Name" inputId="settings-name">
                            <input
                                id="settings-name"
                                type="text"
                                value={settings.name}
                                maxLength={100}
                                aria-invalid={nameError ? true : undefined}
                                aria-describedby={nameError ? 'settings-name-error' : undefined}
                                onChange={(e) => updateSetting('name', e.target.value)}
                                onBlur={commitName}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                className="bg-muted border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all w-full max-w-xs"
                            />
                            {nameError && (
                                <p id="settings-name-error" role="alert" className="text-xs text-red-500 mt-1">{nameError}</p>
                            )}
                        </SettingRow>
                        <SettingRow label="Email Address" inputId="settings-email">
                            <input
                                id="settings-email"
                                type="email"
                                value={settings.email}
                                disabled
                                className="bg-muted/60 border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none text-muted-foreground cursor-not-allowed w-full max-w-xs"
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
                        <SettingRow label="Language" inputId="settings-language">
                            <select
                                id="settings-language"
                                value={settings.language}
                                onChange={(e) => updateSetting('language', e.target.value)}
                                className="bg-muted border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="en">English</option>
                                <option value="fr">Français</option>
                                <option value="es">Español</option>
                            </select>
                        </SettingRow>
                        <SettingRow label="Timezone" inputId="settings-timezone">
                            <select
                                id="settings-timezone"
                                value={settings.timezone}
                                onChange={(e) => updateSetting('timezone', e.target.value)}
                                className="bg-muted border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
                            >
                                <option value="Africa/Lagos">Lagos (GMT+1)</option>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">New York (EST)</option>
                                <option value="Europe/London">London (GMT)</option>
                                <option value="Asia/Tokyo">Tokyo (JST)</option>
                            </select>
                        </SettingRow>
                        <SettingRow label="Default View" inputId="settings-default-view">
                            <select
                                id="settings-default-view"
                                value={settings.defaultView}
                                onChange={(e) => updateSetting('defaultView', e.target.value)}
                                className="bg-muted border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
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
                        {/* BACKSCOPED session 51: Email Notifications / Favorite Team Updates /
                            Weekly Digest. Confirmed via a full audit (grep across src/) that
                            none of these three have any backing system anywhere: no email
                            pipeline, no per-team notification filtering, no digest job. They
                            wrote to the DB but nothing ever read them -- pure decoration that
                            misled users into thinking they controlled a real feature.
                            Richard's call: hide rather than fake-wire. State/load/save left
                            intact above -- reinstate by uncommenting below once the backing
                            feature actually exists.
                        <SettingRow label="Email Notifications">
                            <Toggle
                                enabled={settings.emailNotifications}
                                onChange={(val) => updateSetting('emailNotifications', val)}
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
                        */}
                        <SettingRow label="Push Notifications">
                            <Toggle
                                enabled={settings.pushNotifications}
                                onChange={(val) => updateSetting('pushNotifications', val)}
                            />
                        </SettingRow>
                        <SettingRow label="Match Event Alerts">
                            <Toggle
                                enabled={settings.matchAlerts}
                                onChange={(val) => updateSetting('matchAlerts', val)}
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
                                className="bg-muted border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary transition-all"
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
                                className="px-4 py-2 bg-muted border border-border rounded-xl hover:bg-muted/70 transition-all text-sm font-bold flex items-center gap-2"
                            >
                                <Lock size={14} />
                                Update
                            </button>
                        </SettingRow>
                    </SettingsSection>
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
        <div id={id} className="bg-muted border border-border rounded-[32px] p-6 md:p-8 scroll-mt-24">
            <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                    {icon}
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-display italic uppercase tracking-tight mb-1">{title}</h2>
                    <p className="text-sm text-foreground/60">{description}</p>
                </div>
            </div>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );
}

// BACKLOG-399 H5: `label` rendered as a plain <span> -- no programmatic
// association with the actual input/select in `children`, so a screen-reader
// user got no label announcement on any of the 6 form controls this wraps.
// `inputId`, when passed, renders a real <label htmlFor> instead; rows that
// wrap a Toggle/button (no `id`-bearing form control) simply omit it and keep
// the <span> fallback -- same visual output either way.
function SettingRow({ label, children, inputId }: { label: string; children: React.ReactNode; inputId?: string }) {
    const labelClassName = "text-sm font-bold text-foreground/80";
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 border-b border-border/50 last:border-0">
            {inputId ? (
                <label htmlFor={inputId} className={labelClassName}>{label}</label>
            ) : (
                <span className={labelClassName}>{label}</span>
            )}
            <div>{children}</div>
        </div>
    );
}

// Shown only from real request outcomes: "Saved" appears after the server
// accepted a change, never optimistically.
function SaveStatus({ pending, lastResult }: { pending: number; lastResult: 'saved' | 'error' | null }) {
    let content: React.ReactNode = null;
    if (pending > 0) {
        content = (<><Loader2 size={14} className="animate-spin" />Saving...</>);
    } else if (lastResult === 'saved') {
        content = (<><Check size={14} className="text-green-500" />Saved</>);
    } else if (lastResult === 'error') {
        content = (<span className="text-red-500">Not saved</span>);
    }
    return (
        <div role="status" aria-live="polite" className="ml-auto flex items-center gap-1.5 text-xs font-bold text-foreground/60 min-h-[1rem]">
            {content}
        </div>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
    // ... (implementation remains same)
    return (
        <button
            role="switch"
            aria-checked={enabled}
            onClick={() => onChange(!enabled)}
            className={`relative w-14 h-8 rounded-full transition-all ${enabled ? 'bg-primary' : 'bg-muted'
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
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted border border-border text-foreground/60 hover:bg-muted/70'
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
        } catch (error) {
            toast.error(getClientErrorMessage(error, 'Failed to update password'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6"
            >
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-display uppercase tracking-tight">Change Password</h2>
                    <button onClick={onClose} aria-label="Close" className="text-foreground/40 hover:text-foreground">
                        <VolumeX className="w-5 h-5" style={{ transform: 'rotate(45deg)' }} /> {/* Using VolumeX as generic close icon - or check imports */}
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="change-password-current" className="block text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">Current Password</label>
                        <input
                            id="change-password-current"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Enter current password"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="change-password-new" className="block text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">New Password</label>
                        <input
                            id="change-password-new"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Enter new password"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="change-password-confirm" className="block text-xs font-bold uppercase tracking-wider text-foreground/40 mb-1">Confirm New Password</label>
                        <input
                            id="change-password-confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all"
                            placeholder="Confirm new password"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-muted hover:bg-muted/70 text-sm font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold transition-all disabled:bg-primary/60"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}


