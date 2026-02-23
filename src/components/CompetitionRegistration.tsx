'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Upload,
    Users,
    School,
    Trophy,
    Plus,
    Trash2,
    Save
} from 'lucide-react';

interface TeamInfo {
    teamName: string;
    schoolName: string;
    shortName: string;
    color: string;
    logo: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
}

interface PlayerInfo {
    id: string;
    name: string;
    jerseyName: string;
    number: number;
    position: string;
    age: number;
    height: string;
    weight: string;
    nationality: string;
    college: string;
    department: string;
    image: string;
}

interface CompetitionRegistrationProps {
    competitionId: string;
    competitionName: string;
    playersPerSide: number;
    gender: 'male' | 'female' | 'mixed';
}

export default function CompetitionRegistration({
    competitionId,
    competitionName,
    playersPerSide = 11,
    gender = 'mixed',
}: CompetitionRegistrationProps) {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Team information state
    const [teamInfo, setTeamInfo] = useState<TeamInfo>({
        teamName: '',
        schoolName: '',
        shortName: '',
        color: '#000000',
        logo: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        notes: '',
    });

    // Players state
    const [players, setPlayers] = useState<PlayerInfo[]>([]);

    // Universities state
    const [universities, setUniversities] = useState<string[]>([]);

    const steps = [
        { number: 1, title: 'Team Information', icon: School },
        { number: 2, title: 'Add Players', icon: Users },
        { number: 3, title: 'Review & Submit', icon: Check },
    ];

    const positions = playersPerSide === 5
        ? ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
        : ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Winger'];

    // Fetch universities on component mount
    useEffect(() => {
        const fetchUniversities = async () => {
            try {
                const response = await fetch('/api/universities');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.universities) {
                        setUniversities(data.universities);
                    }
                }
            } catch (error) {
                console.error('Error fetching universities:', error);
            }
        };

        fetchUniversities();
    }, []);

    // Add a new player
    const addPlayer = () => {
        const newPlayer: PlayerInfo = {
            id: `player-${Date.now()}`,
            name: '',
            jerseyName: '',
            number: players.length + 1,
            position: 'Midfielder',
            age: 20,
            height: '',
            weight: '',
            nationality: 'Nigeria',
            college: '',
            department: '',
            image: '',
        };
        setPlayers([...players, newPlayer]);
    };

    // Remove a player
    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    };

    // Update player info
    const updatePlayer = (id: string, field: keyof PlayerInfo, value: any) => {
        setPlayers(players.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    // Handle team info submission
    const handleTeamSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentStep(2);
    };

    // Handle final submission
    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/competitions/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    competitionId,
                    teamInfo,
                    players,
                }),
            });

            if (response.ok) {
                router.push(`/competitions/${competitionId}/registration-success`);
            } else {
                alert('Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 bg-purple-500/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                        <Trophy className="w-5 h-5 text-purple-400" />
                        <span className="text-purple-300 font-medium">Competition Registration</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
                        {competitionName}
                    </h1>
                    <p className="text-gray-300 text-lg">
                        {playersPerSide}-aside • {gender.charAt(0).toUpperCase() + gender.slice(1)}
                    </p>
                </motion.div>

                {/* Progress Steps */}
                <div className="mb-12">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        {steps.map((step, index) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${currentStep >= step.number
                                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                                            : 'bg-gray-700 text-gray-400'
                                            }`}
                                    >
                                        {currentStep > step.number ? (
                                            <Check className="w-6 h-6" />
                                        ) : (
                                            <step.icon className="w-6 h-6" />
                                        )}
                                    </motion.div>
                                    <span className={`text-sm font-medium ${currentStep >= step.number ? 'text-white' : 'text-gray-500'
                                        }`}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`h-1 flex-1 mx-4 rounded transition-all ${currentStep > step.number ? 'bg-purple-500' : 'bg-gray-700'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold text-white mb-6">Team Information</h2>
                            <form onSubmit={handleTeamSubmit} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Team Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={teamInfo.teamName}
                                            onChange={(e) => setTeamInfo({ ...teamInfo, teamName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., University of Lagos FC"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            School/University Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            list="universities-list"
                                            value={teamInfo.schoolName}
                                            onChange={(e) => setTeamInfo({ ...teamInfo, schoolName: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., University of Lagos"
                                        />
                                        <datalist id="universities-list">
                                            {universities.map((university) => (
                                                <option key={university} value={university} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Short Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={5}
                                            value={teamInfo.shortName}
                                            onChange={(e) => setTeamInfo({ ...teamInfo, shortName: e.target.value.toUpperCase() })}
                                            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., UNILAG"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Team Color
                                        </label>
                                        <input
                                            type="color"
                                            value={teamInfo.color}
                                            onChange={(e) => setTeamInfo({ ...teamInfo, color: e.target.value })}
                                            className="w-full h-12 px-2 bg-white/5 border border-gray-600 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Team Logo
                                    </label>
                                    <div className="space-y-3">
                                        {/* Logo Preview */}
                                        {teamInfo.logo && (
                                            <div className="flex items-center gap-4 p-4 bg-white/5 border border-gray-600 rounded-lg">
                                                <img
                                                    src={teamInfo.logo}
                                                    alt="Team Logo"
                                                    className="w-16 h-16 object-contain rounded-lg bg-white/10"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23374151" width="64" height="64"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="12">No Image</text></svg>';
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <p className="text-white text-sm font-medium">Logo Preview</p>
                                                    <p className="text-gray-400 text-xs truncate">{teamInfo.logo}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setTeamInfo({ ...teamInfo, logo: '' })}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Logo URL Input */}
                                        <input
                                            type="url"
                                            value={teamInfo.logo}
                                            onChange={(e) => setTeamInfo({ ...teamInfo, logo: e.target.value })}
                                            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="https://example.com/logo.png or upload below"
                                        />

                                        {/* File Upload Button */}
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            setTeamInfo({ ...teamInfo, logo: reader.result as string });
                                                        };
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                className="hidden"
                                                id="logo-upload"
                                            />
                                            <label
                                                htmlFor="logo-upload"
                                                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 cursor-pointer transition-all"
                                            >
                                                <Upload className="w-5 h-5" />
                                                Upload Logo Image
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-700 pt-6">
                                    <h3 className="text-xl font-semibold text-white mb-4">Contact Information</h3>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Contact Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={teamInfo.contactName}
                                                onChange={(e) => setTeamInfo({ ...teamInfo, contactName: e.target.value })}
                                                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="Team Manager/Coach"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Email *
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={teamInfo.contactEmail}
                                                onChange={(e) => setTeamInfo({ ...teamInfo, contactEmail: e.target.value })}
                                                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="contact@example.com"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Phone Number *
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                value={teamInfo.contactPhone}
                                                onChange={(e) => setTeamInfo({ ...teamInfo, contactPhone: e.target.value })}
                                                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="+234 XXX XXX XXXX"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Additional Notes (optional)
                                    </label>
                                    <textarea
                                        value={teamInfo.notes}
                                        onChange={(e) => setTeamInfo({ ...teamInfo, notes: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="Any special requirements or information..."
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        className="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30"
                                    >
                                        Next Step
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Add Players</h2>
                                <button
                                    onClick={addPlayer}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Player
                                </button>
                            </div>

                            <div className="space-y-4 mb-8 max-h-[600px] overflow-y-auto pr-2">
                                {players.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                        <p>No players added yet. Click "Add Player" to start.</p>
                                    </div>
                                ) : (
                                    players.map((player, index) => (
                                        <motion.div
                                            key={player.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white/5 border border-gray-700 rounded-xl p-6"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-white">Player {index + 1}</h3>
                                                <button
                                                    onClick={() => removePlayer(player.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Full Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={player.name}
                                                        onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="John Doe"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Name on Jersey (if different)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.jerseyName}
                                                        onChange={(e) => updatePlayer(player.id, 'jerseyName', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="Optional"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Number *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="1"
                                                        max="99"
                                                        value={player.number}
                                                        onChange={(e) => updatePlayer(player.id, 'number', parseInt(e.target.value))}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Position *
                                                    </label>
                                                    <select
                                                        value={player.position}
                                                        onChange={(e) => updatePlayer(player.id, 'position', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    >
                                                        {positions.map(pos => (
                                                            <option key={pos} value={pos}>{pos}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Age
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="15"
                                                        max="40"
                                                        value={player.age}
                                                        onChange={(e) => updatePlayer(player.id, 'age', parseInt(e.target.value))}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Height (cm)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.height}
                                                        onChange={(e) => updatePlayer(player.id, 'height', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="175"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Weight (kg)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.weight}
                                                        onChange={(e) => updatePlayer(player.id, 'weight', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="70"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Nationality
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.nationality}
                                                        onChange={(e) => updatePlayer(player.id, 'nationality', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="Nigeria"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        College/Faculty/School (optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.college}
                                                        onChange={(e) => updatePlayer(player.id, 'college', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="e.g., Engineering, Sciences, Arts, Faculty of Law"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Different universities use different terms (College, Faculty, School, etc.)
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Department/Course/Program (optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={player.department}
                                                        onChange={(e) => updatePlayer(player.id, 'department', e.target.value)}
                                                        className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="e.g., Computer Science, Medicine, Business Admin"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Your specific department, course, or program of study
                                                    </p>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-medium text-gray-400 mb-1">
                                                        Player Photo
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        {player.image && (
                                                            <img
                                                                src={player.image}
                                                                alt={player.name}
                                                                className="w-12 h-12 object-cover rounded-lg bg-white/10"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect fill="%23374151" width="48" height="48"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%239CA3AF" font-size="10">No Photo</text></svg>';
                                                                }}
                                                            />
                                                        )}
                                                        <div className="flex-1 flex gap-2">
                                                            <input
                                                                type="url"
                                                                value={player.image}
                                                                onChange={(e) => updatePlayer(player.id, 'image', e.target.value)}
                                                                className="flex-1 px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                                placeholder="Photo URL or upload"
                                                            />
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onloadend = () => {
                                                                                updatePlayer(player.id, 'image', reader.result as string);
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                    className="hidden"
                                                                    id={`player-image-${player.id}`}
                                                                />
                                                                <label
                                                                    htmlFor={`player-image-${player.id}`}
                                                                    className="flex items-center justify-center px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-purple-300 cursor-pointer transition-all"
                                                                >
                                                                    <Upload className="w-4 h-4" />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                    Back
                                </button>
                                <button
                                    onClick={() => setCurrentStep(3)}
                                    disabled={players.length === 0}
                                    className="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Review
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold text-white mb-6">Review & Submit</h2>

                            {/* Team Summary */}
                            <div className="bg-white/5 border border-gray-700 rounded-xl p-6 mb-6">
                                <h3 className="text-xl font-semibold text-white mb-4">Team Information</h3>
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-400">Team Name:</span>
                                        <p className="text-white font-medium">{teamInfo.teamName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">School:</span>
                                        <p className="text-white font-medium">{teamInfo.schoolName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Short Name:</span>
                                        <p className="text-white font-medium">{teamInfo.shortName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Contact:</span>
                                        <p className="text-white font-medium">{teamInfo.contactName}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Email:</span>
                                        <p className="text-white font-medium">{teamInfo.contactEmail}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Phone:</span>
                                        <p className="text-white font-medium">{teamInfo.contactPhone}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Players Summary */}
                            <div className="bg-white/5 border border-gray-700 rounded-xl p-6 mb-8">
                                <h3 className="text-xl font-semibold text-white mb-4">
                                    Players ({players.length})
                                </h3>
                                <div className="space-y-2">
                                    {players.map((player, index) => (
                                        <div key={player.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                                            <div className="flex items-center gap-4">
                                                <span className="text-gray-400 font-mono">#{player.number}</span>
                                                <span className="text-white font-medium">{player.name}</span>
                                            </div>
                                            <span className="text-purple-400 text-sm">{player.position}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                    Back
                                </button>
                                <button
                                    onClick={handleFinalSubmit}
                                    disabled={isSubmitting}
                                    className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Submit Registration
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
