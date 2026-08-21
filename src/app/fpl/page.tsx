import { notFound } from 'next/navigation';

// Feature backscoped — see BACKLOG-028. Reinstatement blocker: Phase 7.
export default function FplPage() { notFound(); }

// 'use client';

// import { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import {
//     Trophy,
//     Users,
//     TrendingUp,
//     Calendar,
//     DollarSign,
//     Star,
//     ArrowRight,
//     Plus,
//     Search,
//     Filter,
//     Award,
//     Target,
//     Zap
// } from 'lucide-react';

// interface FPLTeam {
//     id: string;
//     name: string;
//     totalPoints: number;
//     overallRank: number;
//     gameweekRank: number;
//     bankBalance: number;
//     teamValue: number;
//     freeTransfers: number;
// }

// interface Gameweek {
//     id: string;
//     name: string;
//     number: number;
//     status: string;
//     deadlineDate: Date;
//     averageScore: number;
//     highestScore: number;
// }

// export default function FPLPage() {
//     const router = useRouter();
//     const [userTeam, setUserTeam] = useState<FPLTeam | null>(null);
//     const [currentGameweek, setCurrentGameweek] = useState<Gameweek | null>(null);
//     const [loading, setLoading] = useState(true);
//     const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'transfers' | 'leagues'>('overview');

//     useEffect(() => {
//         fetchData();
//     }, []);

//     const fetchData = async () => {
//         try {
//             // In a real app, get userId from auth context
//             const userId = 'user_1'; // Placeholder

//             // Fetch user's team
//             const teamRes = await fetch(`/api/fpl/teams?userId=${userId}`);
//             if (teamRes.ok) {
//                 const teams = await teamRes.json();
//                 if (teams.length > 0) {
//                     setUserTeam(teams[0]);
//                 }
//             }

//             // Fetch current gameweek
//             // const gwRes = await fetch('/api/fpl/gameweeks?current=true');
//             // if (gwRes.ok) {
//             //     const gw = await gwRes.json();
//             //     setCurrentGameweek(gw);
//             // }
//         } catch (error) {
//             console.error('Error fetching FPL data:', error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleCreateTeam = () => {
//         router.push('/fpl/create-team');
//     };

//     if (loading) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
//                 <div className="text-white text-xl">Loading Fantasy Football...</div>
//             </div>
//         );
//     }

//     if (!userTeam) {
//         return (
//             <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
//                 <div className="max-w-4xl mx-auto">
//                     {/* Hero Section */}
//                     <div className="text-center mb-12 pt-12">
//                         <div className="inline-block p-4 bg-white/10 backdrop-blur-md rounded-full mb-6">
//                             <Trophy className="w-16 h-16 text-yellow-400" />
//                         </div>
//                         <h1 className="text-5xl font-bold text-white mb-4">
//                             Fantasy Football League
//                         </h1>
//                         <p className="text-xl text-white/80 mb-8">
//                             Build your dream team, compete with friends, and prove you're the best manager
//                         </p>
//                         <button
//                             onClick={handleCreateTeam}
//                             className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg flex items-center gap-2 mx-auto"
//                         >
//                             <Plus className="w-5 h-5" />
//                             Create Your Team
//                             <ArrowRight className="w-5 h-5" />
//                         </button>
//                     </div>

//                     {/* Features Grid */}
//                     <div className="grid md:grid-cols-3 gap-6 mb-12">
//                         <FeatureCard
//                             icon={<Users className="w-8 h-8" />}
//                             title="Build Your Squad"
//                             description="Select 15 players within a £100m budget"
//                             color="from-blue-500 to-cyan-500"
//                         />
//                         <FeatureCard
//                             icon={<TrendingUp className="w-8 h-8" />}
//                             title="Earn Points"
//                             description="Score points based on real match performances"
//                             color="from-blue-500 to-blue-500"
//                         />
//                         <FeatureCard
//                             icon={<Trophy className="w-8 h-8" />}
//                             title="Compete & Win"
//                             description="Join leagues and climb the rankings"
//                             color="from-yellow-500 to-orange-500"
//                         />
//                     </div>

//                     {/* How It Works */}
//                     <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
//                         <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
//                         <div className="space-y-4">
//                             <Step number={1} text="Create your team with a £100m budget" />
//                             <Step number={2} text="Select your captain to earn double points" />
//                             <Step number={3} text="Make transfers each gameweek (1 free transfer)" />
//                             <Step number={4} text="Earn points based on player performances" />
//                             <Step number={5} text="Compete in leagues and win prizes" />
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
//             <div className="max-w-7xl mx-auto">
//                 {/* Header */}
//                 <div className="mb-8">
//                     <div className="flex items-center justify-between mb-6">
//                         <div>
//                             <h1 className="text-4xl font-bold text-white mb-2">{userTeam.name}</h1>
//                             <p className="text-white/70">Gameweek {currentGameweek?.number || 1}</p>
//                         </div>
//                         <div className="flex gap-4">
//                             <button className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-colors border border-white/20">
//                                 <Search className="w-5 h-5" />
//                             </button>
//                             <button className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform">
//                                 Make Transfers
//                             </button>
//                         </div>
//                     </div>

//                     {/* Stats Cards */}
//                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                         <StatCard
//                             icon={<Trophy className="w-6 h-6" />}
//                             label="Total Points"
//                             value={userTeam.totalPoints.toLocaleString()}
//                             color="from-yellow-500 to-orange-500"
//                         />
//                         <StatCard
//                             icon={<Target className="w-6 h-6" />}
//                             label="Overall Rank"
//                             value={userTeam.overallRank?.toLocaleString() || 'N/A'}
//                             color="from-blue-500 to-cyan-500"
//                         />
//                         <StatCard
//                             icon={<DollarSign className="w-6 h-6" />}
//                             label="Bank"
//                             value={`£${userTeam.bankBalance.toFixed(1)}m`}
//                             color="from-blue-500 to-blue-500"
//                         />
//                         <StatCard
//                             icon={<Zap className="w-6 h-6" />}
//                             label="Free Transfers"
//                             value={userTeam.freeTransfers.toString()}
//                             color="from-purple-500 to-pink-500"
//                         />
//                     </div>
//                 </div>

//                 {/* Tabs */}
//                 <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
//                     <div className="flex border-b border-white/20">
//                         <TabButton
//                             active={activeTab === 'overview'}
//                             onClick={() => setActiveTab('overview')}
//                             icon={<Star className="w-5 h-5" />}
//                             label="Overview"
//                         />
//                         <TabButton
//                             active={activeTab === 'team'}
//                             onClick={() => setActiveTab('team')}
//                             icon={<Users className="w-5 h-5" />}
//                             label="My Team"
//                         />
//                         <TabButton
//                             active={activeTab === 'transfers'}
//                             onClick={() => setActiveTab('transfers')}
//                             icon={<TrendingUp className="w-5 h-5" />}
//                             label="Transfers"
//                         />
//                         <TabButton
//                             active={activeTab === 'leagues'}
//                             onClick={() => setActiveTab('leagues')}
//                             icon={<Trophy className="w-5 h-5" />}
//                             label="Leagues"
//                         />
//                     </div>

//                     <div className="p-6">
//                         {activeTab === 'overview' && (
//                             <div className="text-white">
//                                 <h2 className="text-2xl font-bold mb-4">Gameweek Overview</h2>
//                                 <p className="text-white/70">
//                                     View your team's performance, upcoming fixtures, and more.
//                                 </p>
//                                 <div className="mt-6 grid md:grid-cols-2 gap-6">
//                                     <div className="bg-white/5 rounded-xl p-6 border border-white/10">
//                                         <h3 className="text-lg font-semibold mb-4">Gameweek Stats</h3>
//                                         <div className="space-y-3">
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">Average Score</span>
//                                                 <span className="font-bold">{currentGameweek?.averageScore || 0}</span>
//                                             </div>
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">Highest Score</span>
//                                                 <span className="font-bold">{currentGameweek?.highestScore || 0}</span>
//                                             </div>
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">Your Rank</span>
//                                                 <span className="font-bold">{userTeam.gameweekRank?.toLocaleString() || 'N/A'}</span>
//                                             </div>
//                                         </div>
//                                     </div>
//                                     <div className="bg-white/5 rounded-xl p-6 border border-white/10">
//                                         <h3 className="text-lg font-semibold mb-4">Team Value</h3>
//                                         <div className="space-y-3">
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">Squad Value</span>
//                                                 <span className="font-bold">£{userTeam.teamValue.toFixed(1)}m</span>
//                                             </div>
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">In Bank</span>
//                                                 <span className="font-bold">£{userTeam.bankBalance.toFixed(1)}m</span>
//                                             </div>
//                                             <div className="flex justify-between">
//                                                 <span className="text-white/70">Total Value</span>
//                                                 <span className="font-bold">£{(userTeam.teamValue + userTeam.bankBalance).toFixed(1)}m</span>
//                                             </div>
//                                         </div>
//                                     </div>
//                                 </div>
//                             </div>
//                         )}
//                         {activeTab === 'team' && (
//                             <div className="text-white text-center py-12">
//                                 <Users className="w-16 h-16 mx-auto mb-4 text-white/50" />
//                                 <h3 className="text-xl font-semibold mb-2">Team Management</h3>
//                                 <p className="text-white/70 mb-6">View and manage your squad</p>
//                                 <button
//                                     onClick={() => router.push('/fpl/team')}
//                                     className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
//                                 >
//                                     View My Team
//                                 </button>
//                             </div>
//                         )}
//                         {activeTab === 'transfers' && (
//                             <div className="text-white text-center py-12">
//                                 <TrendingUp className="w-16 h-16 mx-auto mb-4 text-white/50" />
//                                 <h3 className="text-xl font-semibold mb-2">Transfers</h3>
//                                 <p className="text-white/70 mb-6">Make changes to your squad</p>
//                                 <button
//                                     onClick={() => router.push('/fpl/transfers')}
//                                     className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
//                                 >
//                                     Make Transfers
//                                 </button>
//                             </div>
//                         )}
//                         {activeTab === 'leagues' && (
//                             <div className="text-white text-center py-12">
//                                 <Trophy className="w-16 h-16 mx-auto mb-4 text-white/50" />
//                                 <h3 className="text-xl font-semibold mb-2">My Leagues</h3>
//                                 <p className="text-white/70 mb-6">Join and compete in leagues</p>
//                                 <button
//                                     onClick={() => router.push('/fpl/leagues')}
//                                     className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 font-bold rounded-xl hover:scale-105 transition-transform"
//                                 >
//                                     View Leagues
//                                 </button>
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

// function FeatureCard({ icon, title, description, color }: any) {
//     return (
//         <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:scale-105 transition-transform">
//             <div className={`inline-block p-3 bg-gradient-to-r ${color} rounded-lg mb-4`}>
//                 {icon}
//             </div>
//             <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
//             <p className="text-white/70">{description}</p>
//         </div>
//     );
// }

// function Step({ number, text }: { number: number; text: string }) {
//     return (
//         <div className="flex items-center gap-4">
//             <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-gray-900 font-bold">
//                 {number}
//             </div>
//             <p className="text-white">{text}</p>
//         </div>
//     );
// }

// function StatCard({ icon, label, value, color }: any) {
//     return (
//         <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
//             <div className={`inline-block p-2 bg-gradient-to-r ${color} rounded-lg mb-2`}>
//                 {icon}
//             </div>
//             <p className="text-white/70 text-sm mb-1">{label}</p>
//             <p className="text-2xl font-bold text-white">{value}</p>
//         </div>
//     );
// }

// function TabButton({ active, onClick, icon, label }: any) {
//     return (
//         <button
//             onClick={onClick}
//             className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 transition-colors ${active
//                     ? 'bg-white/10 text-white border-b-2 border-yellow-400'
//                     : 'text-white/70 hover:text-white hover:bg-white/5'
//                 }`}
//         >
//             {icon}
//             <span className="font-semibold">{label}</span>
//         </button>
//     );
// }

