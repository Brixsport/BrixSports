'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Settings,
    Sliders,
    ToggleLeft,
    ToggleRight,
    Save,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    Zap,
    Bell,
    Lock
} from 'lucide-react';

interface Setting {
    key: string;
    value: string;
    type: 'string' | 'number' | 'boolean' | 'json';
    category: 'algorithm' | 'system' | 'features';
    description: string;
}

interface SettingsData {
    settings: Setting[];
    timestamp: string;
}

export default function SettingsPage() {
    const [data, setData] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modifiedSettings, setModifiedSettings] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/settings');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateSetting = (key: string, value: string) => {
        setModifiedSettings(prev => ({ ...prev, [key]: value }));
        setSaveStatus('idle');
    };

    const saveSetting = async (key: string, value: string) => {
        try {
            setSaving(true);
            const response = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            });

            if (response.ok) {
                setSaveStatus('success');
                // Remove from modified settings
                setModifiedSettings(prev => {
                    const newSettings = { ...prev };
                    delete newSettings[key];
                    return newSettings;
                });
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch (error) {
            console.error('Failed to save setting:', error);
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const saveAllSettings = async () => {
        try {
            setSaving(true);
            for (const [key, value] of Object.entries(modifiedSettings)) {
                await saveSetting(key, value);
            }
            setSaveStatus('success');
            setModifiedSettings({});
        } catch (error) {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const algorithmSettings = data?.settings.filter(s => s.category === 'algorithm') || [];
    const systemSettings = data?.settings.filter(s => s.category === 'system') || [];
    const featureSettings = data?.settings.filter(s => s.category === 'features') || [];

    const hasModifications = Object.keys(modifiedSettings).length > 0;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none mb-2">
                            System Settings
                        </h1>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                            Algorithm configuration & system preferences
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {saveStatus === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500"
                            >
                                <CheckCircle2 size={16} />
                                <span className="text-xs font-bold uppercase">Saved</span>
                            </motion.div>
                        )}
                        {saveStatus === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500"
                            >
                                <AlertCircle size={16} />
                                <span className="text-xs font-bold uppercase">Error</span>
                            </motion.div>
                        )}
                        <button
                            onClick={saveAllSettings}
                            disabled={!hasModifications || saving}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-xl font-bold uppercase text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={16} />
                            Save All Changes
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <>
                        {/* Algorithm Settings */}
                        <SettingsSection
                            icon={<TrendingUp size={24} />}
                            title="Algorithm Configuration"
                            description="Configure rating calculation and Eye Point weighting"
                            settings={algorithmSettings}
                            modifiedSettings={modifiedSettings}
                            onUpdate={updateSetting}
                            onSave={saveSetting}
                            saving={saving}
                        />

                        {/* System Settings */}
                        <SettingsSection
                            icon={<Settings size={24} />}
                            title="System Configuration"
                            description="Core system settings and operational modes"
                            settings={systemSettings}
                            modifiedSettings={modifiedSettings}
                            onUpdate={updateSetting}
                            onSave={saveSetting}
                            saving={saving}
                        />

                        {/* Feature Flags */}
                        <SettingsSection
                            icon={<Zap size={24} />}
                            title="Feature Flags"
                            description="Enable or disable platform features"
                            settings={featureSettings}
                            modifiedSettings={modifiedSettings}
                            onUpdate={updateSetting}
                            onSave={saveSetting}
                            saving={saving}
                        />

                        {/* Warning Banner */}
                        {hasModifications && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-yellow-500/10 border border-yellow-500/20 rounded-[32px] p-6"
                            >
                                <div className="flex items-start gap-4">
                                    <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
                                    <div>
                                        <h3 className="font-bold text-yellow-500 mb-2">Unsaved Changes</h3>
                                        <p className="text-sm text-white/60">
                                            You have {Object.keys(modifiedSettings).length} unsaved change(s).
                                            Click "Save All Changes" to apply them to the system.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function SettingsSection({
    icon,
    title,
    description,
    settings,
    modifiedSettings,
    onUpdate,
    onSave,
    saving
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    settings: Setting[];
    modifiedSettings: Record<string, string>;
    onUpdate: (key: string, value: string) => void;
    onSave: (key: string, value: string) => void;
    saving: boolean;
}) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="text-primary">{icon}</div>
                <div>
                    <h2 className="font-display text-2xl italic uppercase">{title}</h2>
                    <p className="text-xs text-white/40 mt-1">{description}</p>
                </div>
            </div>

            <div className="space-y-6">
                {settings.map((setting) => (
                    <SettingItem
                        key={setting.key}
                        setting={setting}
                        value={modifiedSettings[setting.key] ?? setting.value}
                        isModified={setting.key in modifiedSettings}
                        onUpdate={onUpdate}
                        onSave={onSave}
                        saving={saving}
                    />
                ))}
            </div>
        </div>
    );
}

function SettingItem({
    setting,
    value,
    isModified,
    onUpdate,
    onSave,
    saving
}: {
    setting: Setting;
    value: string;
    isModified: boolean;
    onUpdate: (key: string, value: string) => void;
    onSave: (key: string, value: string) => void;
    saving: boolean;
}) {
    const handleChange = (newValue: string) => {
        onUpdate(setting.key, newValue);
    };

    const handleSave = () => {
        onSave(setting.key, value);
    };

    // Boolean toggles auto-save on click instead of the pending-change + separate
    // Save button flow below -- that flow's failure feedback was a single banner at
    // the top of a long page, easy to miss while scrolled down on a toggle. This
    // keeps success/error feedback right next to the control that was clicked.
    if (setting.type === 'boolean') {
        return <BooleanSettingItem setting={setting} initialValue={value} />;
    }

    return (
        <div className={`p-4 rounded-2xl transition-all ${isModified ? 'bg-primary/10 border border-primary/20' : 'bg-white/5'
            }`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-bold">{setting.key.split('.').pop()}</h3>
                        {isModified && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">
                                Modified
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-white/40 mb-3">{setting.description}</p>

                    {setting.type === 'number' ? (
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            step="0.01"
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all w-32"
                        />
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-primary transition-all w-full max-w-md"
                        />
                    )}
                </div>

                {isModified && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-primary text-black rounded-lg text-xs font-bold uppercase hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        Save
                    </button>
                )}
            </div>
        </div>
    );
}

function BooleanSettingItem({ setting, initialValue }: { setting: Setting; initialValue: string }) {
    const [value, setValue] = useState(initialValue);
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    const handleToggle = async () => {
        const newValue = value === 'true' ? 'false' : 'true';
        const previousValue = value;
        setValue(newValue); // optimistic
        setStatus('saving');
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: setting.key, value: newValue }),
            });
            if (response.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 2000);
            } else {
                setValue(previousValue); // revert -- the write didn't actually happen
                setStatus('error');
            }
        } catch (error) {
            console.error('Failed to save setting:', error);
            setValue(previousValue);
            setStatus('error');
        }
    };

    return (
        <div className={`p-4 rounded-2xl transition-all ${status === 'error' ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5'
            }`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <p className="text-xs text-white/40 mb-3">{setting.description}</p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToggle}
                            disabled={status === 'saving'}
                            className="flex items-center gap-2 group disabled:opacity-60"
                        >
                            {value === 'true' ? (
                                <>
                                    <ToggleRight className="text-primary" size={32} />
                                    <span className="text-xs font-bold text-primary">Enabled</span>
                                </>
                            ) : (
                                <>
                                    <ToggleLeft className="text-white/20" size={32} />
                                    <span className="text-xs font-bold text-white/40">Disabled</span>
                                </>
                            )}
                        </button>
                        {status === 'saving' && (
                            <RefreshCw className="animate-spin text-white/40" size={14} />
                        )}
                        {status === 'success' && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-500">
                                <CheckCircle2 size={12} /> Saved
                            </span>
                        )}
                        {status === 'error' && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-500">
                                <AlertCircle size={12} /> Failed to save, try again
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
