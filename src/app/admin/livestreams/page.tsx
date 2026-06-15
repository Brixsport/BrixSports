'use client';

import { useState, useEffect } from 'react';
import { Video, Plus, Edit, Trash2, Eye, EyeOff, Save, X, Radio, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeamLogo } from '@/lib/utils/team-logo';

interface Match {
    id: string;
    sport: string;
    homeTeam: { name: string; logo: string };
    awayTeam: { name: string; logo: string };
    startTime: string;
    status: string;
    competition: string;
    livestreamUrl?: string;
    livestreamType?: string;
    livestreamEnabled?: boolean;
    livestreamViewers?: number;
    livestreamChatEnabled?: boolean;
}

interface LivestreamForm {
    matchId: string;
    livestreamUrl: string;
    livestreamType: 'youtube' | 'twitch' | 'facebook' | 'hls' | 'dash' | 'custom';
    livestreamEnabled: boolean;
    livestreamChatEnabled: boolean;
    livestreamStartTime?: string;
    livestreamEndTime?: string;
}

export default function LivestreamsAdminPage() {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingMatch, setEditingMatch] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [formData, setFormData] = useState<LivestreamForm>({
        matchId: '',
        livestreamUrl: '',
        livestreamType: 'youtube',
        livestreamEnabled: false,
        livestreamChatEnabled: true,
    });

    useEffect(() => {
        fetchMatches();
    }, []);

    const fetchMatches = async () => {
        try {
            const response = await fetch('/api/matches?limit=100');
            if (response.ok) {
                const data = await response.json();
                console.log('Fetched matches:', data);

                // Handle different API response formats
                let allMatches = [];
                if (Array.isArray(data)) {
                    allMatches = data;
                } else if (data.matches && Array.isArray(data.matches)) {
                    allMatches = data.matches;
                } else if (data.data && Array.isArray(data.data)) {
                    allMatches = data.data;
                }

                // Filter for UPCOMING and LIVE matches only
                const filteredMatches = allMatches.filter(
                    (match: any) => match.status === 'UPCOMING' || match.status === 'LIVE'
                );

                console.log('Filtered matches (UPCOMING/LIVE):', filteredMatches);
                setMatches(filteredMatches);

                if (filteredMatches.length === 0) {
                    setErrorMessage('No upcoming or live matches found. Only UPCOMING and LIVE matches can have livestreams configured.');
                }
            } else {
                const errorData = await response.json();
                setErrorMessage(`Failed to load matches: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            setErrorMessage('Network error: Unable to fetch matches. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (match: Match) => {
        setEditingMatch(match.id);
        setFormData({
            matchId: match.id,
            livestreamUrl: match.livestreamUrl || '',
            livestreamType: (match.livestreamType as any) || 'youtube',
            livestreamEnabled: match.livestreamEnabled || false,
            livestreamChatEnabled: match.livestreamChatEnabled ?? true,
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const response = await fetch(`/api/matches/${formData.matchId}/livestream`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                await fetchMatches();
                setEditingMatch(null);
                setSuccessMessage('Livestream settings updated successfully!');
                setTimeout(() => setSuccessMessage(null), 5000);
            } else {
                const error = await response.json();
                if (response.status === 401) {
                    setErrorMessage('Authentication required. Please log in as an admin.');
                } else if (response.status === 403) {
                    setErrorMessage('Admin access required. You do not have permission to update livestreams.');
                } else {
                    setErrorMessage(error.error || 'Failed to update livestream settings');
                }
            }
        } catch (error) {
            console.error('Error saving livestream:', error);
            setErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditingMatch(null);
        setFormData({
            matchId: '',
            livestreamUrl: '',
            livestreamType: 'youtube',
            livestreamEnabled: false,
            livestreamChatEnabled: true,
        });
    };

    const toggleLivestream = async (matchId: string, enabled: boolean) => {
        try {
            const response = await fetch(`/api/matches/${matchId}/livestream`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ livestreamEnabled: !enabled }),
            });

            if (response.ok) {
                await fetchMatches();
            }
        } catch (error) {
            console.error('Error toggling livestream:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-600 rounded-xl">
                            <Video className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Livestream Management</h1>
                            <p className="text-gray-400">Manage livestream settings for matches</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-green-600/20 text-green-500 px-4 py-2 rounded-lg">
                        <Radio className="w-4 h-4 animate-pulse" />
                        <span className="font-semibold">
                            {matches.filter(m => m.livestreamEnabled).length} Active Streams
                        </span>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-blue-400 mb-1">How to Add a Livestream Link</h3>
                        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                            <li>Click the <strong>Edit button</strong> (blue pencil icon) on any match</li>
                            <li>Paste your livestream URL in the <strong>"Stream URL"</strong> field</li>
                            <li>Select the appropriate <strong>Stream Type</strong> (YouTube, Twitch, etc.)</li>
                            <li>Check <strong>"Enable Livestream"</strong> to make it visible to users</li>
                            <li>Click <strong>"Save Changes"</strong> to update</li>
                        </ol>
                        <p className="text-xs text-gray-400 mt-2">
                            Note: You must be logged in as an admin to save changes.
                        </p>
                    </div>
                </div>

                {/* Success/Error Messages */}
                {successMessage && (
                    <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <p className="text-green-400 font-semibold">{successMessage}</p>
                    </div>
                )}

                {errorMessage && (
                    <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                        <div className="flex-1">
                            <p className="text-red-400 font-semibold">{errorMessage}</p>
                            {errorMessage.includes('Authentication') && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Please navigate to the login page and sign in with admin credentials.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Matches List */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Match</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Competition</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Start Time</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Stream URL</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Type</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {matches.map((match) => (
                                    <tr key={match.id} className="hover:bg-gray-800/50 transition-colors">
                                        {editingMatch === match.id ? (
                                            <>
                                                <td colSpan={7} className="px-6 py-4">
                                                    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
                                                        <h3 className="text-lg font-semibold mb-4">
                                                            Edit Livestream: {match.homeTeam.name} vs {match.awayTeam.name}
                                                        </h3>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Stream URL */}
                                                            <div className="md:col-span-2">
                                                                <label className="block text-sm font-medium mb-2">Stream URL</label>
                                                                <input
                                                                    type="url"
                                                                    value={formData.livestreamUrl}
                                                                    onChange={(e) => setFormData({ ...formData, livestreamUrl: e.target.value })}
                                                                    placeholder="https://youtube.com/watch?v=..."
                                                                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                                />
                                                            </div>

                                                            {/* Stream Type */}
                                                            <div>
                                                                <label className="block text-sm font-medium mb-2">Stream Type</label>
                                                                <select
                                                                    value={formData.livestreamType}
                                                                    onChange={(e) => setFormData({ ...formData, livestreamType: e.target.value as any })}
                                                                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                                >
                                                                    <option value="youtube">YouTube</option>
                                                                    <option value="twitch">Twitch</option>
                                                                    <option value="facebook">Facebook</option>
                                                                    <option value="hls">HLS</option>
                                                                    <option value="dash">DASH</option>
                                                                    <option value="custom">Custom</option>
                                                                </select>
                                                            </div>

                                                            {/* Toggles */}
                                                            <div className="space-y-3">
                                                                <label className="flex items-center gap-3 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={formData.livestreamEnabled}
                                                                        onChange={(e) => setFormData({ ...formData, livestreamEnabled: e.target.checked })}
                                                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500"
                                                                    />
                                                                    <span className="text-sm font-medium">Enable Livestream</span>
                                                                </label>

                                                                <label className="flex items-center gap-3 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={formData.livestreamChatEnabled}
                                                                        onChange={(e) => setFormData({ ...formData, livestreamChatEnabled: e.target.checked })}
                                                                        className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500"
                                                                    />
                                                                    <span className="text-sm font-medium">Enable Chat</span>
                                                                </label>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-3 pt-4">
                                                            <button
                                                                onClick={handleSave}
                                                                disabled={saving}
                                                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                                                            >
                                                                {saving ? (
                                                                    <>
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                        Saving...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Save className="w-4 h-4" />
                                                                        Save Changes
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={handleCancel}
                                                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex -space-x-2">
                                                            <TeamLogo logo={match.homeTeam.logo} name={match.homeTeam.name} size="sm" className="rounded-full border-2 border-gray-900" />
                                                            <TeamLogo logo={match.awayTeam.logo} name={match.awayTeam.name} size="sm" className="rounded-full border-2 border-gray-900" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">
                                                                {match.homeTeam.name} vs {match.awayTeam.name}
                                                            </p>
                                                            <p className="text-xs text-gray-400">{match.sport}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">{match.competition}</td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {new Date(match.startTime).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {match.livestreamUrl ? (
                                                        <span className="text-xs text-green-500 truncate block max-w-[200px]">
                                                            {match.livestreamUrl}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-500">Not set</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {match.livestreamType ? (
                                                        <span className="px-2 py-1 bg-blue-600/20 text-blue-500 rounded text-xs font-semibold uppercase">
                                                            {match.livestreamType}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleLivestream(match.id, match.livestreamEnabled || false)}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                                                            match.livestreamEnabled
                                                                ? "bg-green-600/20 text-green-500 hover:bg-green-600/30"
                                                                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                                                        )}
                                                    >
                                                        {match.livestreamEnabled ? (
                                                            <>
                                                                <Eye className="w-3 h-3" />
                                                                Active
                                                            </>
                                                        ) : (
                                                            <>
                                                                <EyeOff className="w-3 h-3" />
                                                                Inactive
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(match)}
                                                            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                                }
                                {matches.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Video className="w-12 h-12 text-gray-600" />
                                                <p className="text-gray-400 font-semibold">No upcoming or live matches</p>
                                                <p className="text-sm text-gray-500">Only UPCOMING and LIVE matches can have livestreams configured</p>
                                                <a href="/admin/matches" className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors">
                                                    Manage Matches
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div >
    );
}
