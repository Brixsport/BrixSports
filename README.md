# 🏆 Brix V2 - University Sports Management Platform

<div align="center">

![Brix V2 Logo](public/icon.png)

**A comprehensive sports management platform for university competitions**

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🎯 Overview

Brix V2 is a modern, feature-rich sports management platform designed specifically for university sports competitions. It provides real-time match tracking, live streaming, predictions, lineup building, and comprehensive analytics.

### Why Brix V2?

- **🎥 Live Streaming**: Watch matches live with integrated chat
- **🎯 Predictions**: Make predictions and compete on leaderboards
- **⚽ Lineup Builder**: Create and share custom team formations
- **📊 Real-time Stats**: Live scores and detailed match statistics
- **🏆 Multi-Sport**: Support for Football, Basketball, and more
- **📱 Mobile-First**: Fully responsive design
- **🔐 Secure**: Built-in authentication and authorization
- **⚡ Fast**: Optimized performance with Next.js 15

---

## ✨ Features

### For Fans

- **Live Match Streaming** with real-time chat
- **Match Predictions** with points and leaderboards
- **Interactive Lineup Builder** (XI)
- **Real-time Scores** and statistics
- **Fan Polls** and voting
- **Team & Player Profiles** with detailed stats
- **Competition Brackets** and standings
- **Push Notifications** for match updates

### For Admins

- **Match Management** - Create, update, and manage matches
- **Livestream Control** - Configure streaming settings
- **Logger Assignment** - Assign match loggers
- **Competition Management** - Organize tournaments
- **User Management** - Manage users and permissions
- **Analytics Dashboard** - View platform statistics

### For Developers

- **Modern Tech Stack** - Next.js 15, React 19, TypeScript
- **Type-Safe Database** - Drizzle ORM with SQLite/Turso
- **Component Library** - Radix UI with Tailwind CSS
- **Real-time Updates** - Socket.io integration
- **API-First Design** - RESTful API endpoints
- **Comprehensive Docs** - Interactive documentation

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd BrixSports

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see your application!

### Seed Sample Data

```bash
# Seed BUSA Football
npx tsx src/db/seed-busa-football.ts

# Seed BUSA Basketball
npx tsx src/db/seed-busa-basketball.ts

# Seed test accounts
npm run seed:accounts
```

---

## 📚 Documentation

### Quick Links

- **[Developer Onboarding](./DEVELOPER_ONBOARDING.md)** - Complete setup and development guide
- **[API Reference](./API_REFERENCE.md)** - Comprehensive API documentation
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Architecture Diagram](./ARCHITECTURE_DIAGRAM.md)** - System architecture overview
- **[Quick Start Guide](./QUICK_START_GUIDE.md)** - Feature-specific quick start

### Interactive Documentation

Visit `/docs` in your browser for interactive documentation with:
- Searchable content
- Code examples with copy buttons
- Beautiful, responsive UI
- Comprehensive guides

---

## 🏗️ Tech Stack

### Frontend

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend

- **API**: Next.js API Routes
- **Database**: SQLite (local) / Turso (production)
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js
- **Real-time**: Socket.io
- **Notifications**: Web Push API

### Development Tools

- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Database GUI**: Drizzle Studio
- **Version Control**: Git

---

## 📁 Project Structure

```
BrixSports/
├── public/              # Static assets
├── src/
│   ├── app/            # Next.js pages and API routes
│   │   ├── api/       # API endpoints
│   │   ├── admin/     # Admin dashboard
│   │   ├── football/  # Football pages
│   │   └── ...
│   ├── components/    # React components
│   │   ├── ui/       # Base UI components
│   │   ├── lineup/   # Lineup builder
│   │   └── ...
│   ├── db/           # Database schemas and scripts
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions
│   └── types/        # TypeScript types
├── .env.example      # Environment variables template
├── drizzle.config.ts # Drizzle ORM config
└── package.json      # Dependencies
```

---

## 🎨 Screenshots

### Homepage
Beautiful, modern interface with live matches and predictions.

### Match Overlay
Comprehensive match details with stats, lineups, and predictions.

### Lineup Builder
Interactive drag-and-drop team formation editor.

### Admin Dashboard
Powerful tools for managing matches, users, and content.

---

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:turbo        # Start with Turbopack

# Building
npm run build            # Create production build
npm run start            # Start production server

# Database
npm run db:generate      # Generate migrations
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio

# Code Quality
npm run lint             # Run ESLint
npm run lint -- --fix    # Fix linting issues
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL=file:./local.db
# TURSO_DATABASE_URL=libsql://...
# TURSO_AUTH_TOKEN=...

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Cloudinary (for images)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import repository in Vercel
3. Configure environment variables
4. Deploy!

See [Deployment Guide](./VERCEL_DEPLOYMENT.md) for detailed instructions.

### Database (Turso)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create brix-v2

# Get credentials
turso db show brix-v2 --url
turso db tokens create brix-v2
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Write TypeScript for all new code
- Use Tailwind CSS for styling
- Test your changes thoroughly
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Database by [Turso](https://turso.tech/)
- Deployed on [Vercel](https://vercel.com/)

---

## 📞 Support

- **Documentation**: Visit `/docs` or check the docs folder
- **Issues**: [GitHub Issues](https://github.com/Brixsport/BrixSports/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Brixsport/BrixSports/discussions)

---

## 🗺️ Roadmap

### Current Version (v2.0)

- ✅ Live streaming with chat
- ✅ Match predictions and leaderboards
- ✅ Lineup builder (XI)
- ✅ Admin dashboard
- ✅ Multi-sport support
- ✅ Real-time updates

### Upcoming Features

- 🔄 Mobile app (React Native)
- 🔄 Advanced analytics
- 🔄 Fantasy league
- 🔄 Social features (comments, shares)
- 🔄 Video highlights
- 🔄 AI-powered predictions

---

## 📊 Stats

- **Lines of Code**: 50,000+
- **Components**: 100+
- **API Endpoints**: 50+
- **Database Tables**: 20+
- **Supported Sports**: 3+

---

<div align="center">

**Made with ❤️ by the Brix V2 Team**

[⬆ Back to Top](#-brix-v2---university-sports-management-platform)

</div>
