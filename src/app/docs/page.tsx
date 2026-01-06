'use client';

import React, { useState, useEffect } from 'react';
import {
    BookOpen, Code, Database, Rocket, Settings, Users,
    FileCode, GitBranch, Terminal, Package, Layers,
    Zap, Shield, Globe, Search, ChevronRight, ExternalLink,
    Copy, Check, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocSection {
    id: string;
    title: string;
    icon: React.ElementType;
    content: React.ReactNode;
}

const CodeBlock = ({ code, language = 'bash' }: { code: string; language?: string }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group">
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={copyToClipboard}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                    )}
                </button>
            </div>
            <pre className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl overflow-x-auto border border-white/10">
                <code className={`language-${language} text-sm text-gray-300`}>{code}</code>
            </pre>
        </div>
    );
};

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState('getting-started');
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const sections: DocSection[] = [
        {
            id: 'getting-started',
            title: 'Getting Started',
            icon: Rocket,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                            Welcome to Brix V2
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Brix V2 is a comprehensive sports management platform built with Next.js 15, React 19, and modern web technologies.
                            This documentation will help you get up and running quickly.
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-blue-400 mb-3 flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            Quick Start
                        </h3>
                        <ol className="space-y-3 text-gray-300">
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold">1</span>
                                <span>Clone the repository and install dependencies</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold">2</span>
                                <span>Set up your environment variables</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold">3</span>
                                <span>Initialize the database</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold">4</span>
                                <span>Start the development server</span>
                            </li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Installation</h3>
                        <CodeBlock code={`# Clone the repository
git clone <repository-url>
cd -BrixsV2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Initialize database
npm run db:push

# Start development server
npm run dev`} />
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-amber-400 mb-3">⚠️ Prerequisites</h3>
                        <ul className="space-y-2 text-gray-300">
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                Node.js 18.x or higher
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                npm or yarn package manager
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                Git for version control
                            </li>
                        </ul>
                    </div>
                </div>
            ),
        },
        {
            id: 'architecture',
            title: 'Architecture',
            icon: Layers,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                            System Architecture
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Brix V2 follows a modern, scalable architecture with clear separation of concerns.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                                <Globe className="w-5 h-5" />
                                Frontend
                            </h3>
                            <ul className="space-y-2 text-gray-300 text-sm">
                                <li>• Next.js 15 (App Router)</li>
                                <li>• React 19</li>
                                <li>• TypeScript</li>
                                <li>• Tailwind CSS 4</li>
                                <li>• Framer Motion</li>
                                <li>• Radix UI Components</li>
                            </ul>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                Backend
                            </h3>
                            <ul className="space-y-2 text-gray-300 text-sm">
                                <li>• Next.js API Routes</li>
                                <li>• Drizzle ORM</li>
                                <li>• SQLite / Turso</li>
                                <li>• NextAuth.js</li>
                                <li>• Socket.io</li>
                                <li>• Web Push Notifications</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Project Structure</h3>
                        <CodeBlock language="plaintext" code={`src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   ├── football/          # Football pages
│   ├── basketball/        # Basketball pages
│   └── ...
├── components/            # React components
│   ├── ui/               # UI components (Radix)
│   ├── lineup/           # Lineup builder
│   ├── predictions/      # Predictions
│   └── ...
├── db/                    # Database schemas & scripts
│   ├── schema.ts         # Main schema
│   ├── seed.ts           # Seed data
│   └── ...
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
└── types/                 # TypeScript types`} />
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-green-400 mb-3">Key Features</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-white">Live Streaming</p>
                                    <p className="text-sm text-gray-400">Real-time match streaming with chat</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-white">Match Predictions</p>
                                    <p className="text-sm text-gray-400">User predictions with leaderboards</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-white">Lineup Builder</p>
                                    <p className="text-sm text-gray-400">Interactive team formation editor</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <ChevronRight className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-white">Admin Dashboard</p>
                                    <p className="text-sm text-gray-400">Comprehensive management tools</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'database',
            title: 'Database',
            icon: Database,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-4">
                            Database Schema
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Brix V2 uses Drizzle ORM with SQLite (local) or Turso (production) for data persistence.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Core Tables</h3>
                        <div className="space-y-4">
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                                <h4 className="font-semibold text-green-400 mb-2">matches</h4>
                                <p className="text-sm text-gray-400 mb-3">Stores all match information including scores, status, and livestream data</p>
                                <CodeBlock language="typescript" code={`{
  id: string
  homeTeamId: string
  awayTeamId: string
  competitionId: string
  status: 'UPCOMING' | 'LIVE' | 'FINISHED'
  homeScore: number
  awayScore: number
  livestreamUrl: string
  livestreamEnabled: boolean
  ...
}`} />
                            </div>

                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                                <h4 className="font-semibold text-green-400 mb-2">teams</h4>
                                <p className="text-sm text-gray-400 mb-3">Team information and statistics</p>
                                <CodeBlock language="typescript" code={`{
  id: string
  name: string
  sport: 'Football' | 'Basketball' | ...
  logo: string
  college: string
  ...
}`} />
                            </div>

                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                                <h4 className="font-semibold text-green-400 mb-2">players</h4>
                                <p className="text-sm text-gray-400 mb-3">Player profiles and statistics</p>
                                <CodeBlock language="typescript" code={`{
  id: string
  name: string
  teamId: string
  position: string
  jerseyNumber: number
  rating: number
  ...
}`} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Database Commands</h3>
                        <CodeBlock code={`# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push

# Open Drizzle Studio (GUI)
npm run db:studio

# Run migrations
npm run db:migrate`} />
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-blue-400 mb-3">Seeding Data</h3>
                        <p className="text-gray-300 mb-3">Use the provided seed scripts to populate your database:</p>
                        <CodeBlock code={`# Seed BUSA Football
npx tsx src/db/seed-busa-football.ts

# Seed BUSA Basketball
npx tsx src/db/seed-busa-basketball.ts

# Import player rosters
npx tsx src/db/import-player-rosters.ts

# Seed test accounts
npm run seed:accounts`} />
                    </div>
                </div>
            ),
        },
        {
            id: 'api',
            title: 'API Reference',
            icon: Code,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4">
                            API Reference
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Comprehensive API documentation for all available endpoints.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-b border-white/10 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">GET</span>
                                    <code className="text-white">/api/matches</code>
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="text-gray-300 mb-3">Fetch all matches with optional filters</p>
                                <CodeBlock language="typescript" code={`// Query Parameters
{
  sport?: 'Football' | 'Basketball'
  status?: 'UPCOMING' | 'LIVE' | 'FINISHED'
  competitionId?: string
  date?: string
}

// Response
{
  matches: Match[]
  total: number
}`} />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-white/10 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">POST</span>
                                    <code className="text-white">/api/predictions</code>
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="text-gray-300 mb-3">Submit a match prediction</p>
                                <CodeBlock language="typescript" code={`// Request Body
{
  matchId: string
  predictedHomeScore: number
  predictedAwayScore: number
  predictedWinner: 'home' | 'away' | 'draw'
  confidence: number // 0-100
}

// Response
{
  prediction: Prediction
  potentialPoints: number
}`} />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">PATCH</span>
                                    <code className="text-white">/api/matches/[id]/livestream</code>
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="text-gray-300 mb-3">Update livestream settings (Admin only)</p>
                                <CodeBlock language="typescript" code={`// Request Body
{
  livestreamUrl?: string
  livestreamType?: 'youtube' | 'twitch' | 'custom'
  livestreamEnabled?: boolean
  livestreamChatEnabled?: boolean
}

// Response
{
  match: Match
  message: string
}`} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-amber-400 mb-3">Authentication</h3>
                        <p className="text-gray-300 mb-3">Most endpoints require authentication. Include the session token in your requests:</p>
                        <CodeBlock language="typescript" code={`// Using fetch
const response = await fetch('/api/predictions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
  credentials: 'include' // Important for session cookies
});`} />
                    </div>
                </div>
            ),
        },
        {
            id: 'components',
            title: 'Components',
            icon: Package,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent mb-4">
                            Component Library
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Reusable components built with React, TypeScript, and Tailwind CSS.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-pink-400 mb-2">MatchOverlay</h3>
                            <p className="text-sm text-gray-400 mb-3">Comprehensive match detail modal with tabs for stats, lineups, and predictions</p>
                            <CodeBlock language="typescript" code={`import { MatchOverlay } from '@/components'

<MatchOverlay
  match={match}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>`} />
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-pink-400 mb-2">InteractivePitch</h3>
                            <p className="text-sm text-gray-400 mb-3">Drag-and-drop lineup builder with formation support</p>
                            <CodeBlock language="typescript" code={`import { InteractivePitch } from '@/components/lineup'

<InteractivePitch
  formation="4-3-3"
  players={players}
  onUpdate={handleUpdate}
/>`} />
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-pink-400 mb-2">MatchPredictionCard</h3>
                            <p className="text-sm text-gray-400 mb-3">Interactive prediction interface with confidence slider</p>
                            <CodeBlock language="typescript" code={`import { MatchPredictionCard } from '@/components'

<MatchPredictionCard
  match={match}
  userId={userId}
  onSubmit={handleSubmit}
/>`} />
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-xl p-4">
                            <h3 className="font-semibold text-pink-400 mb-2">LivestreamPlayer</h3>
                            <p className="text-sm text-gray-400 mb-3">Embedded video player with support for multiple platforms</p>
                            <CodeBlock language="typescript" code={`import { LivestreamPlayer } from '@/components/livestream'

<LivestreamPlayer
  url={streamUrl}
  type="youtube"
  autoplay={true}
/>`} />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-blue-400 mb-3">UI Components</h3>
                        <p className="text-gray-300 mb-3">Built on Radix UI primitives with custom styling:</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="text-gray-300">• Button</div>
                            <div className="text-gray-300">• Dialog</div>
                            <div className="text-gray-300">• Dropdown</div>
                            <div className="text-gray-300">• Tabs</div>
                            <div className="text-gray-300">• Select</div>
                            <div className="text-gray-300">• Slider</div>
                            <div className="text-gray-300">• Switch</div>
                            <div className="text-gray-300">• Toast</div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: 'deployment',
            title: 'Deployment',
            icon: Rocket,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-4">
                            Deployment Guide
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            Deploy Brix V2 to production with Vercel and Turso.
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-purple-400 mb-3">Vercel Deployment</h3>
                        <ol className="space-y-3 text-gray-300">
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-semibold">1</span>
                                <div>
                                    <p className="font-semibold">Connect to Vercel</p>
                                    <p className="text-sm text-gray-400">Import your repository from GitHub</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-semibold">2</span>
                                <div>
                                    <p className="font-semibold">Configure Environment Variables</p>
                                    <p className="text-sm text-gray-400">Add all required env vars from .env.example</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-semibold">3</span>
                                <div>
                                    <p className="font-semibold">Deploy</p>
                                    <p className="text-sm text-gray-400">Vercel will automatically build and deploy</p>
                                </div>
                            </li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Environment Variables</h3>
                        <CodeBlock code={`# Database
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Cloudinary (for image uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Web Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...`} />
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-green-400 mb-3">Turso Database Setup</h3>
                        <CodeBlock code={`# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create brix-v2

# Get connection URL
turso db show brix-v2 --url

# Create auth token
turso db tokens create brix-v2`} />
                    </div>

                    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-amber-400 mb-3">Build Optimization</h3>
                        <p className="text-gray-300 mb-3">Ensure optimal build performance:</p>
                        <ul className="space-y-2 text-gray-300">
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                Use Next.js Image component for optimized images
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                Enable server components where possible
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-amber-400" />
                                Implement proper caching strategies
                            </li>
                        </ul>
                    </div>
                </div>
            ),
        },
        {
            id: 'contributing',
            title: 'Contributing',
            icon: Users,
            content: (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                            Contributing Guidelines
                        </h2>
                        <p className="text-gray-300 text-lg leading-relaxed">
                            We welcome contributions! Follow these guidelines to contribute effectively.
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-teal-400 mb-3">Development Workflow</h3>
                        <CodeBlock code={`# 1. Fork and clone the repository
git clone https://github.com/your-username/brix-v2.git

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes
# ... code ...

# 4. Run tests and linting
npm run lint
npm run build

# 5. Commit your changes
git add .
git commit -m "feat: add your feature description"

# 6. Push to your fork
git push origin feature/your-feature-name

# 7. Create a Pull Request`} />
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-white mb-3">Commit Convention</h3>
                        <p className="text-gray-300 mb-3">We follow conventional commits:</p>
                        <div className="space-y-2">
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-lg p-3">
                                <code className="text-green-400">feat:</code>
                                <span className="text-gray-300 ml-2">New feature</span>
                            </div>
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-lg p-3">
                                <code className="text-blue-400">fix:</code>
                                <span className="text-gray-300 ml-2">Bug fix</span>
                            </div>
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-lg p-3">
                                <code className="text-purple-400">docs:</code>
                                <span className="text-gray-300 ml-2">Documentation changes</span>
                            </div>
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-lg p-3">
                                <code className="text-amber-400">refactor:</code>
                                <span className="text-gray-300 ml-2">Code refactoring</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6">
                        <h3 className="text-xl font-semibold text-blue-400 mb-3">Code Style</h3>
                        <ul className="space-y-2 text-gray-300">
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                Use TypeScript for all new code
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                Follow ESLint configuration
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                Use Tailwind CSS for styling
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                Write meaningful component and variable names
                            </li>
                            <li className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-blue-400" />
                                Add comments for complex logic
                            </li>
                        </ul>
                    </div>
                </div>
            ),
        },
    ];

    const filteredSections = sections.filter(section =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Brix V2 Docs</h1>
                                <p className="text-xs text-gray-400">Developer Documentation</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            {mobileMenuOpen ? (
                                <X className="w-6 h-6 text-white" />
                            ) : (
                                <Menu className="w-6 h-6 text-white" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <AnimatePresence>
                        {(mobileMenuOpen || (isMounted && window.innerWidth >= 1024)) && (
                            <motion.aside
                                initial={{ x: -300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -300, opacity: 0 }}
                                className="lg:w-64 flex-shrink-0"
                            >
                                <div className="sticky top-24 space-y-4">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search docs..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    </div>

                                    {/* Navigation */}
                                    <nav className="space-y-1">
                                        {filteredSections.map((section) => {
                                            const Icon = section.icon;
                                            return (
                                                <button
                                                    key={section.id}
                                                    onClick={() => {
                                                        setActiveSection(section.id);
                                                        setMobileMenuOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeSection === section.id
                                                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-white'
                                                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                                                        }`}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                    <span className="font-medium">{section.title}</span>
                                                </button>
                                            );
                                        })}
                                    </nav>

                                    {/* Quick Links */}
                                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-4">
                                        <h3 className="text-sm font-semibold text-white mb-3">Quick Links</h3>
                                        <div className="space-y-2">
                                            <a
                                                href="https://github.com"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                                            >
                                                <GitBranch className="w-4 h-4" />
                                                GitHub
                                                <ExternalLink className="w-3 h-3 ml-auto" />
                                            </a>
                                            <a
                                                href="/admin"
                                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Shield className="w-4 h-4" />
                                                Admin Dashboard
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </motion.aside>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-white/10 rounded-2xl p-8"
                            >
                                {sections.find(s => s.id === activeSection)?.content}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
            </div>
        </div>
    );
}
