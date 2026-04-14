"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, Heart, Shield, ArrowRight, Loader2, Trophy, Camera, User as UserIcon, X, Bell, BellRing, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getPushService } from "@/lib/notifications/push-service";

interface Team {
    id: string;
    name: string;
    logo: string;
    university?: string;
    color?: string;
}

interface OnboardingModalProps {
    isOpen: boolean;
    userId: string;
    userName: string;
    onComplete: () => void;
    token: string;
}

export function OnboardingModal({ isOpen, userId, userName, onComplete, token }: OnboardingModalProps) {
    const [step, setStep] = useState(1);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Step 1: Favorite Team (Single Select)
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

    // Step 2: Follow Teams (Multi Select)
    const [followedTeamIds, setFollowedTeamIds] = useState<string[]>([]);

    // Step 3: Profile Picture
    const [avatar, setAvatar] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 4: Push Notifications
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const pushService = getPushService();

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTeams();
            checkPushStatus();
        }
    }, [isOpen]);

    const checkPushStatus = async () => {
        try {
            await pushService.init();
            const permission = pushService.getPermission();
            setPushPermission(permission);
            if (permission === 'granted') {
                const subscribed = await pushService.isSubscribed();
                setIsSubscribed(subscribed);
            }
        } catch (error) {
            console.error('Error checking push status:', error);
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await fetch('/api/teams');
            if (!res.ok) throw new Error("Failed to fetch teams");
            const data = await res.json();
            setTeams(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load teams");
        } finally {
            setLoading(false);
        }
    };

    const filteredTeams = teams.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.university && team.university.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleSelectFavorite = (id: string) => {
        setSelectedTeamId(id);
    };

    const handleToggleFollow = (id: string) => {
        if (followedTeamIds.includes(id)) {
            setFollowedTeamIds(followedTeamIds.filter(tid => tid !== id));
        } else {
            setFollowedTeamIds([...followedTeamIds, id]);
        }
    };

    const handleNextStep = async () => {
        if (step === 1 && selectedTeamId) {
            setIsSubmitting(true);
            try {
                // Save favorite Team to profile
                await fetch(`/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ favoriteTeamId: selectedTeamId })
                });

                // Also add to favorites list automatically
                await fetch('/api/users/favorites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        userId,
                        favoriteType: 'team',
                        favoriteId: selectedTeamId
                    })
                });

                setStep(2);
            } catch (error) {
                toast.error("Failed to save selection");
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleFinishFollows = async () => {
        setIsSubmitting(true);
        try {
            // Save all followed teams
            const promises = followedTeamIds.map(id => {
                // Skip if it's the favorite team (already added)
                if (id === selectedTeamId) return Promise.resolve();

                return fetch('/api/users/favorites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        userId,
                        favoriteType: 'team',
                        favoriteId: id
                    })
                });
            });

            await Promise.all(promises);
            setStep(3);
        } catch (error) {
            toast.error("Failed to save follows");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        setIsSubmitting(true);
        try {
            if (avatar) {
                await fetch(`/api/users/${userId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ avatar })
                });
            }
            setStep(4);
        } catch (error) {
            toast.error("Failed to save profile picture");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEnableNotifications = async () => {
        setIsSubscribing(true);
        try {
            const permission = await pushService.requestPermission();
            setPushPermission(permission);

            if (permission === 'granted') {
                const subscription = await pushService.subscribe(userId);
                if (subscription) {
                    setIsSubscribed(true);
                    toast.success('Notifications enabled! You\'ll get alerts for goals, match starts, and more.');
                    // Show a test notification
                    await pushService.showNotification('Welcome to BrixSports! 🎉', {
                        body: 'You\'ll receive live updates for your favorite teams.',
                        icon: '/icons/icon-192x192.png',
                    });
                    setTimeout(() => {
                        toast.success("All set! Transitioning to your dashboard.");
                        onComplete();
                    }, 2000);
                } else {
                    toast.error('Failed to subscribe. Please try again.');
                }
            } else if (permission === 'denied') {
                toast.error('Notifications are blocked. You can enable them later in your browser settings.');
                setTimeout(() => {
                    onComplete();
                }, 1500);
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            toast.error('Something went wrong. You can enable notifications later in Settings.');
            setTimeout(() => {
                onComplete();
            }, 1500);
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleSkipNotifications = () => {
        toast.info('You can enable notifications anytime in Settings.');
        onComplete();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl h-[80vh] bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative"
            >
                {/* Background Details */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between relative z-10">
                    <div>
                        <h2 className="text-2xl font-display uppercase italic text-white mb-1">
                            {step === 1 ? `Welcome, ${userName}!` : step === 2 ? "Stay Updated" : step === 3 ? "Final Touch" : "Never Miss a Moment"}
                        </h2>
                        <p className="text-white/40 text-sm">
                            {step === 1 ? "Which team do you support?" : step === 2 ? "Follow other teams for notifications" : step === 3 ? "Upload a profile picture" : "Get live match updates"}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className={`h-2 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-white/10'}`} />
                        <div className={`h-2 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-white/10'}`} />
                        <div className={`h-2 w-8 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-white/10'}`} />
                        <div className={`h-2 w-8 rounded-full transition-colors ${step >= 4 ? 'bg-primary' : 'bg-white/10'}`} />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 relative z-10">
                    {step === 4 ? (
                        // Step 4: Push Notifications
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="text-center max-w-md"
                            >
                                <div className="w-32 h-32 mx-auto mb-8 relative">
                                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                    <div className="relative w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center">
                                        {isSubscribed ? (
                                            <CheckCircle2 size={64} className="text-primary" />
                                        ) : pushPermission === 'denied' ? (
                                            <Bell size={64} className="text-white/40" />
                                        ) : (
                                            <BellRing size={64} className="text-primary animate-pulse" />
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-2xl font-display uppercase italic mb-4">
                                    {isSubscribed ? 'You\'re All Set!' : 'Get Match Alerts'}
                                </h3>

                                <p className="text-white/60 leading-relaxed mb-8">
                                    {isSubscribed
                                        ? 'You\'ll now receive instant notifications for goals, match starts, and final scores.'
                                        : 'Enable push notifications to get instant alerts when your teams score, matches start, or big moments happen.'}
                                </p>

                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <Smartphone size={18} className="text-primary" />
                                        <span>Works even when the app is closed</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <Trophy size={18} className="text-primary" />
                                        <span>Goal alerts for teams you follow</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-white/60 bg-white/5 p-3 rounded-xl">
                                        <CheckCircle2 size={18} className="text-primary" />
                                        <span>Match start and final score updates</span>
                                    </div>
                                </div>

                                {isSubscribed ? (
                                    <Button
                                        size="lg"
                                        onClick={onComplete}
                                        className="px-8 font-black uppercase tracking-widest"
                                    >
                                        Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                ) : pushPermission === 'denied' ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-white/40">
                                            Notifications are blocked in your browser settings.
                                        </p>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            onClick={handleSkipNotifications}
                                            className="px-8 font-black uppercase tracking-widest"
                                        >
                                            Continue to Dashboard
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <Button
                                            size="lg"
                                            disabled={isSubscribing}
                                            onClick={handleEnableNotifications}
                                            className="px-8 font-black uppercase tracking-widest bg-primary hover:bg-primary/90"
                                        >
                                            {isSubscribing ? (
                                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enabling...</>
                                            ) : (
                                                <><Bell className="mr-2 w-4 h-4" /> Enable Notifications</>
                                            )}
                                        </Button>
                                        <button
                                            onClick={handleSkipNotifications}
                                            className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2"
                                        >
                                            Maybe Later
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    ) : step < 3 ? (
                        <>
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                                <Input
                                    placeholder="Search universities or teams..."
                                    className="pl-12 bg-white/5 border-white/10 h-12 text-white rounded-xl focus:bg-white/10 transition-all font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filteredTeams.map((team) => {
                                        const isSelected = step === 1 ? selectedTeamId === team.id : followedTeamIds.includes(team.id);
                                        const isFavorite = selectedTeamId === team.id;

                                        return (
                                            <motion.button
                                                key={team.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => step === 1 ? handleSelectFavorite(team.id) : handleToggleFollow(team.id)}
                                                disabled={step === 2 && isFavorite}
                                                className={`relative group flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all ${isSelected
                                                        ? 'bg-primary/10 border-primary shadow-[0_0_30px_-10px_rgba(var(--primary-rgb),0.3)]'
                                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                                    } ${step === 2 && isFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="w-20 h-20 relative text-white">
                                                    {team.logo ? (
                                                        <div className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl"
                                                            style={{ backgroundImage: `url(${team.logo})` }}
                                                        />
                                                    ) : (
                                                        <Trophy size={48} className="text-white/20" />
                                                    )}
                                                </div>
                                                <div className="text-center">
                                                    <h3 className={`font-black uppercase text-sm tracking-wide mb-1 ${isSelected ? 'text-primary' : 'text-white'}`}>
                                                        {team.name}
                                                    </h3>
                                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                                        {team.university || "University"}
                                                    </p>
                                                </div>

                                                {isSelected && (
                                                    <div className="absolute top-4 right-4 text-primary">
                                                        {step === 1 ? <Shield className="fill-current" size={20} /> : <CheckCircle2 className="fill-current" size={20} />}
                                                    </div>
                                                )}
                                                {step === 2 && isFavorite && (
                                                    <div className="absolute top-4 right-4 text-primary">
                                                        <Heart className="fill-current" size={20} />
                                                    </div>
                                                )}
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                            <div className="relative group">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="w-48 h-48 md:w-64 md:h-64 rounded-[40px] bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden relative"
                                >
                                    {avatar ? (
                                        <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center p-8">
                                            <UserIcon size={64} className="mx-auto text-white/10 mb-4" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-white/40">No photo selected</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Camera size={48} className="text-primary mb-2" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Upload Photo</span>
                                    </button>
                                </motion.div>

                                {avatar && (
                                    <button
                                        onClick={() => setAvatar(null)}
                                        className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarChange}
                            />

                            <div className="mt-12 text-center max-w-sm">
                                <h3 className="text-xl font-display uppercase italic mb-2">Show them who you are</h3>
                                <p className="text-sm text-white/40 leading-relaxed">
                                    Upload a profile picture so other fans and scouts can recognize you in the Brix community.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/5 flex justify-between items-center bg-[#0A0A0A] relative z-20">
                    {step === 4 ? (
                        // Step 4 has its own buttons in content area
                        <div className="w-full" />
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    if (step === 1) setStep(2);
                                    else if (step === 2) setStep(3);
                                    else setStep(4);
                                }}
                                className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                            >
                                {step === 1 ? "Skip selection" : step === 2 ? "Skip following" : "Skip photo"}
                            </button>

                            <Button
                                size="lg"
                                disabled={isSubmitting || (step === 1 && !selectedTeamId)}
                                onClick={step === 1 ? handleNextStep : step === 2 ? handleFinishFollows : handleSaveProfile}
                                className="px-8 font-black uppercase tracking-widest"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {step < 3 ? (
                                    <>Next Step <ArrowRight className="ml-2 w-4 h-4" /></>
                                ) : (
                                    <>{avatar ? "Save & Continue" : "Continue"} <ArrowRight className="ml-2 w-4 h-4" /></>
                                )}
                            </Button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
