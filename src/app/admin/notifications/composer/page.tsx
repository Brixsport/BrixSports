'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Send, 
  Users, 
  Trophy, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Eye,
  Image as ImageIcon,
  Link as LinkIcon,
  Target,
  Clock,
  ChevronDown,
  Sparkles,
  MessageSquare,
  Megaphone,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Templates for quick notification creation
const NOTIFICATION_TEMPLATES = [
  {
    id: 'match_start',
    name: 'Match Starting',
    icon: Calendar,
    title: '🔴 Match Starting Now!',
    body: '{homeTeam} vs {awayTeam} is about to kick off!',
    actions: [{ action: 'view', title: 'Watch Live' }, { action: 'close', title: 'Dismiss' }],
    vibrate: [200, 100, 200],
  },
  {
    id: 'goal',
    name: 'Goal Scored',
    icon: Trophy,
    title: '⚽ GOAL!',
    body: '{playerName} scores for {teamName}! {homeScore}-{awayScore}',
    actions: [{ action: 'view', title: 'View Match' }, { action: 'close', title: 'Close' }],
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
  },
  {
    id: 'red_card',
    name: 'Red Card',
    icon: AlertTriangle,
    title: '🟥 Red Card!',
    body: '{playerName} has been sent off for {teamName}',
    actions: [{ action: 'view', title: 'View Match' }, { action: 'close', title: 'Close' }],
    vibrate: [500, 200, 500],
    requireInteraction: true,
  },
  {
    id: 'match_end',
    name: 'Match Ended',
    icon: CheckCircle2,
    title: '⏹️ Full Time!',
    body: 'Match finished: {homeTeam} {homeScore} - {awayScore} {awayTeam}',
    actions: [{ action: 'view', title: 'View Summary' }, { action: 'close', title: 'Dismiss' }],
    vibrate: [200, 100, 200],
  },
  {
    id: 'breaking_news',
    name: 'Breaking News',
    icon: Megaphone,
    title: '📰 Breaking News',
    body: 'Important update from BrixSports',
    actions: [{ action: 'view', title: 'Read More' }, { action: 'close', title: 'Dismiss' }],
    vibrate: [200, 100, 200],
  },
  {
    id: 'custom',
    name: 'Custom Message',
    icon: MessageSquare,
    title: '',
    body: '',
    actions: [{ action: 'view', title: 'View' }, { action: 'close', title: 'Close' }],
    vibrate: [200, 100, 200],
  },
];

// Target audience options
const TARGET_OPTIONS = [
  { id: 'all', name: 'All Subscribers', description: 'Send to everyone with push notifications enabled', icon: Users },
  { id: 'team_followers', name: 'Team Followers', description: 'Send to users following specific teams', icon: Trophy },
  { id: 'match_specific', name: 'Match Viewers', description: 'Send to users viewing a specific match', icon: Eye },
];

export default function NotificationComposerPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(NOTIFICATION_TEMPLATES[0]);
  const [targetAudience, setTargetAudience] = useState(TARGET_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    icon: '/icons/icon-192x192.png',
    image: '',
    url: '/',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [{ action: 'view', title: 'View' }, { action: 'close', title: 'Close' }],
    // Template variables
    homeTeam: '',
    awayTeam: '',
    playerName: '',
    teamName: '',
    homeScore: '0',
    awayScore: '0',
    matchId: '',
  });

  // Teams and matches for targeting
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState('');

  useEffect(() => {
    fetchTeamsAndMatches();
    fetchSendHistory();
  }, []);

  const fetchTeamsAndMatches = async () => {
    try {
      const [teamsRes, matchesRes] = await Promise.all([
        fetch('/api/teams'),
        fetch('/api/matches?status=LIVE,UPCOMING')
      ]);
      const teamsData = await teamsRes.json();
      const matchesData = await matchesRes.json();
      setTeams(Array.isArray(teamsData) ? teamsData : teamsData.teams || []);
      setMatches(Array.isArray(matchesData) ? matchesData : matchesData.matches || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchSendHistory = async () => {
    try {
      const res = await fetch('/api/notifications/history');
      if (res.ok) {
        const data = await res.json();
        setSendHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleTemplateSelect = (template: typeof NOTIFICATION_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      title: template.title,
      body: template.body,
      actions: template.actions,
      vibrate: template.vibrate || [200, 100, 200],
      requireInteraction: template.requireInteraction || false,
    }));
  };

  const processTemplateVariables = (text: string) => {
    return text
      .replace(/{homeTeam}/g, formData.homeTeam || 'Home Team')
      .replace(/{awayTeam}/g, formData.awayTeam || 'Away Team')
      .replace(/{playerName}/g, formData.playerName || 'Player')
      .replace(/{teamName}/g, formData.teamName || 'Team')
      .replace(/{homeScore}/g, formData.homeScore || '0')
      .replace(/{awayScore}/g, formData.awayScore || '0');
  };

  const handleSendNotification = async () => {
    if (!formData.title || !formData.body) {
      toast.error('Please fill in both title and body');
      return;
    }

    setIsLoading(true);
    try {
      const processedBody = processTemplateVariables(formData.body);
      const processedTitle = processTemplateVariables(formData.title);

      const payload = {
        title: processedTitle,
        body: processedBody,
        icon: formData.icon,
        image: formData.image || undefined,
        url: formData.url,
        vibrate: formData.vibrate,
        requireInteraction: formData.requireInteraction,
        actions: formData.actions,
        targetAudience: targetAudience.id,
        selectedTeams: targetAudience.id === 'team_followers' ? selectedTeams : undefined,
        selectedMatch: targetAudience.id === 'match_specific' ? selectedMatch : undefined,
        matchId: formData.matchId || undefined,
      };

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`Notification sent to ${result.sentTo} subscribers!`);
        fetchSendHistory();
      } else {
        toast.error(result.error || 'Failed to send notification');
      }
    } catch (error) {
      toast.error('Failed to send notification');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!formData.title || !formData.body) {
      toast.error('Please fill in both title and body');
      return;
    }

    try {
      const pushService = await import('@/lib/notifications/push-service').then(m => m.getPushService());
      await pushService.showNotification(processTemplateVariables(formData.title), {
        body: processTemplateVariables(formData.body),
        icon: formData.icon,
        badge: '/icons/icon-192x192.png',
      });
      toast.success('Local test notification shown!');
    } catch (error) {
      toast.error('Failed to show test notification');
    }
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/notifications" 
              className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="font-display text-2xl md:text-3xl tracking-tight italic uppercase">
                Notification Composer
              </h1>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
                Design and send push notifications to your users
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Eye size={18} />
              <span className="text-xs font-bold uppercase">Preview</span>
            </button>
            <button
              onClick={handleTestNotification}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <Sparkles size={18} />
              <span className="text-xs font-bold uppercase">Test Local</span>
            </button>
            <button
              onClick={handleSendNotification}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-primary border border-primary/50 rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              <Send size={18} />
              <span className="text-xs font-bold uppercase">
                {isLoading ? 'Sending...' : 'Send Now'}
              </span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Templates & Targeting */}
          <div className="space-y-6">
            {/* Templates */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="font-display italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                Quick Templates
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFICATION_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        selectedTemplate.id === template.id
                          ? 'bg-primary/20 border-primary/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={20} className="mb-2" />
                      <span className="text-xs font-bold block">{template.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Target Audience */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="font-display italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2">
                <Target size={18} className="text-primary" />
                Target Audience
              </h2>
              <div className="space-y-2">
                {TARGET_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setTargetAudience(option)}
                      className={`w-full p-3 rounded-xl border transition-all text-left ${
                        targetAudience.id === option.id
                          ? 'bg-primary/20 border-primary/50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <div>
                          <span className="text-xs font-bold block">{option.name}</span>
                          <span className="text-[10px] text-white/40">{option.description}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Targeting Options */}
              <AnimatePresence>
                {targetAudience.id === 'team_followers' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-2"
                  >
                    <label className="text-xs font-bold uppercase text-white/60">Select Teams</label>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {teams.map((team) => (
                        <label
                          key={team.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTeams.includes(team.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTeams([...selectedTeams, team.id]);
                              } else {
                                setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-white/20"
                          />
                          <span className="text-xs">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </motion.div>
                )}

                {targetAudience.id === 'match_specific' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-2"
                  >
                    <label className="text-xs font-bold uppercase text-white/60">Select Match</label>
                    <select
                      value={selectedMatch}
                      onChange={(e) => setSelectedMatch(e.target.value)}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs outline-none focus:border-primary"
                    >
                      <option value="">Select a match...</option>
                      {matches.map((match) => (
                        <option key={match.id} value={match.id}>
                          {match.homeTeam?.name || 'Home'} vs {match.awayTeam?.name || 'Away'} ({match.status})
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Send History */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="font-display italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                Recent History
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {sendHistory.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">No notifications sent yet</p>
                ) : (
                  sendHistory.slice(0, 10).map((item, index) => (
                    <div key={index} className="p-3 rounded-lg bg-white/5 text-xs">
                      <div className="font-bold truncate">{item.title}</div>
                      <div className="text-white/40 mt-1">
                        Sent to {item.sentTo} users • {new Date(item.sentAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Middle Column - Message Editor */}
          <div className="space-y-6">
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
              <h2 className="font-display italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                Message Content
              </h2>

              {/* Title */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-white/60">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification title..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-white/60">Message Body</label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Enter your message..."
                  rows={4}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:border-primary transition-colors resize-none"
                />
                <p className="text-[10px] text-white/40">
                  Use {'{homeTeam}'}, {'{awayTeam}'}, {'{playerName}'}, {'{teamName}'}, {'{homeScore}'}, {'{awayScore}'} as variables
                </p>
              </div>

              {/* Template Variables */}
              {selectedTemplate.id !== 'custom' && selectedTemplate.id !== 'breaking_news' && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <label className="text-xs font-bold uppercase text-white/60">Template Variables</label>
                  
                  {selectedTemplate.id === 'team_followers' || selectedTemplate.id === 'match_start' || selectedTemplate.id === 'match_end' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={formData.homeTeam}
                        onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
                        placeholder="Home Team"
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={formData.awayTeam}
                        onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
                        placeholder="Away Team"
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={formData.homeScore}
                        onChange={(e) => setFormData({ ...formData, homeScore: e.target.value })}
                        placeholder="Home Score"
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={formData.awayScore}
                        onChange={(e) => setFormData({ ...formData, awayScore: e.target.value })}
                        placeholder="Away Score"
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>
                  ) : null}

                  {selectedTemplate.id === 'goal' || selectedTemplate.id === 'red_card' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.playerName}
                        onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                        placeholder="Player Name"
                        className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        placeholder="Team Name"
                        className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={formData.homeScore}
                          onChange={(e) => setFormData({ ...formData, homeScore: e.target.value })}
                          placeholder="Home Score"
                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={formData.awayScore}
                          onChange={(e) => setFormData({ ...formData, awayScore: e.target.value })}
                          placeholder="Away Score"
                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Options */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requireInteraction}
                    onChange={(e) => setFormData({ ...formData, requireInteraction: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20"
                  />
                  <span className="text-xs">Require user interaction to dismiss</span>
                </label>
              </div>

              {/* Icon & URL */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-white/60 flex items-center gap-2">
                    <ImageIcon size={12} />
                    Icon URL
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="/icons/icon-192x192.png"
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-white/60 flex items-center gap-2">
                    <LinkIcon size={12} />
                    Action URL
                  </label>
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="/matches/123"
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-white/60 flex items-center gap-2">
                    <ImageIcon size={12} />
                    Image URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-6">
            <section className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h2 className="font-display italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2">
                <Eye size={18} className="text-primary" />
                Live Preview
              </h2>

              {/* Mobile Preview */}
              <div className="relative mx-auto w-64 bg-gradient-to-b from-gray-900 to-black rounded-[32px] p-4 border-4 border-gray-800">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl" />
                
                {/* Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-white/60 mb-8 px-2">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* App Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="font-bold text-sm">B</span>
                  </div>
                  <span className="text-xs font-bold">BrixSports</span>
                </div>

                {/* Notification Preview */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {formData.icon ? (
                        <img src={formData.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Bell size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">
                        {processTemplateVariables(formData.title) || 'Notification Title'}
                      </div>
                      <div className="text-[10px] text-white/70 line-clamp-3 mt-1">
                        {processTemplateVariables(formData.body) || 'Notification message will appear here...'}
                      </div>
                    </div>
                  </div>
                  {formData.image && (
                    <div className="mt-2 rounded-lg overflow-hidden">
                      <img src={formData.image} alt="" className="w-full h-24 object-cover" />
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    {formData.actions.map((action, idx) => (
                      <button
                        key={idx}
                        className="flex-1 py-1.5 bg-white/10 rounded text-[10px] font-semibold hover:bg-white/20 transition-colors"
                      >
                        {action.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sample Content */}
                <div className="space-y-2">
                  <div className="h-20 bg-white/5 rounded-xl" />
                  <div className="h-20 bg-white/5 rounded-xl" />
                  <div className="h-20 bg-white/5 rounded-xl" />
                </div>
              </div>

              {/* Desktop Preview */}
              <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-white/10">
                <div className="text-[10px] text-white/40 uppercase mb-2">Desktop Preview</div>
                <div className="bg-white text-black rounded-lg p-3 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {formData.icon ? (
                        <img src={formData.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Bell size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        {processTemplateVariables(formData.title) || 'BrixSports'}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {processTemplateVariables(formData.body) || 'New notification'}
                      </div>
                      <div className="flex gap-3 mt-2">
                        {formData.actions.map((action, idx) => (
                          <span key={idx} className="text-xs text-primary font-semibold cursor-pointer hover:underline">
                            {action.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tips */}
            <section className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                Pro Tips
              </h3>
              <ul className="text-xs space-y-1 text-white/70">
                <li>• Keep titles under 50 characters</li>
                <li>• Use emojis to grab attention 🎯</li>
                <li>• Add action buttons for better engagement</li>
                <li>• Test locally before sending to all users</li>
                <li>• Use variables for personalized messages</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
