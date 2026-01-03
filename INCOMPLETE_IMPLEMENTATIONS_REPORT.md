# 🔍 Incomplete Implementations & Hardcoded Data Report

**Generated:** January 3, 2026  
**System:** Brix V2 Sports Management Platform

---

## 📋 Executive Summary

This report identifies incomplete implementations, features that need to be completed, and areas using hardcoded data across the Brix V2 codebase. The findings are categorized by **Priority** and **Impact**.

### Key Statistics
- **TODO Comments Found:** 17
- **Hardcoded Data Instances:** Multiple (documented below)
- **Incomplete Features:** 8 major areas
- **Security Issues:** 3 critical items

---

## 🚨 CRITICAL PRIORITY (P0)

### 1. **Password Hashing Not Implemented**
**Location:** 
- `src/app/api/loggers/route.ts:82`
- `src/app/api/loggers/[id]/route.ts:60`

**Issue:**
```typescript
// TODO: Hash this in production
password, // Storing plain text passwords
```

**Impact:** 🔴 **CRITICAL SECURITY VULNERABILITY**

**Solution Required:**
```typescript
import bcrypt from 'bcryptjs';

// When creating logger
const hashedPassword = await bcrypt.hash(password, 10);
await db.insert(loggers).values({
    ...data,
    password: hashedPassword
});

// When updating logger
if (password) {
    updateData.password = await bcrypt.hash(password, 10);
}
```

**Estimated Time:** 1 hour  
**Priority:** P0 - Must fix before production

---

### 2. **JWT Token Generation Missing**
**Location:** `src/app/api/loggers/auth/route.ts:66`

**Issue:**
```typescript
// TODO: Implement JWT
// token: generateJWT(user[0])
```

**Impact:** 🔴 **Authentication incomplete**

**Solution Required:**
```typescript
import jwt from 'jsonwebtoken';

function generateJWT(user: any) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: 'logger' 
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
    );
}
```

**Estimated Time:** 2 hours  
**Priority:** P0 - Required for logger authentication

---

### 3. **Admin Authentication Missing**
**Location:** `src/app/api/matches/[id]/livestream/route.ts:68`

**Issue:**
```typescript
// TODO: Add admin authentication check
```

**Impact:** 🔴 **Anyone can modify livestream settings**

**Solution Required:**
```typescript
import { verifyAuth } from '@/lib/auth';

export async function PATCH(req: Request) {
    const user = await verifyAuth(req);
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    // ... rest of handler
}
```

**Estimated Time:** 1 hour  
**Priority:** P0 - Security critical

---

## 🔶 HIGH PRIORITY (P1)

### 4. **Push Notifications Not Persisted**
**Location:** 
- `src/app/api/notifications/subscribe/route.ts:47`
- `src/app/api/notifications/subscribe/route.ts:89`
- `src/app/api/notifications/send/route.ts:30`

**Issue:**
```typescript
// TODO: Save to database
// TODO: Remove from database
// TODO: Fetch all push subscriptions from database
```

**Current State:** Subscriptions are not persisted, so they're lost on server restart.

**Solution Required:**
1. Create `push_subscriptions` table:
```sql
CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

2. Implement database operations:
```typescript
// Save subscription
await db.insert(pushSubscriptions).values({
    id: generateId(),
    userId: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    createdAt: Date.now()
});

// Fetch subscriptions
const subscriptions = await db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
```

**Estimated Time:** 3 hours  
**Priority:** P1 - Required for production notifications

---

### 5. **WebSocket Broadcasting Not Implemented**
**Location:**
- `src/app/api/events/route.ts:286`
- `src/app/api/events/route.ts:348`

**Issue:**
```typescript
// TODO: Broadcast via WebSocket
```

**Current State:** Match events are saved to database but not broadcast to connected clients in real-time.

**Solution Required:**
```typescript
import { getIO } from '@/lib/socket';

// After saving event
const io = getIO();
io.to(`match:${matchId}`).emit('match:event', {
    matchId,
    event: newEvent,
    timestamp: Date.now()
});

// Also broadcast score updates
io.to(`match:${matchId}`).emit('match:score:updated', {
    matchId,
    homeScore: updatedMatch.homeScore,
    awayScore: updatedMatch.awayScore
});
```

**Estimated Time:** 2 hours  
**Priority:** P1 - Core feature for live updates

---

### 6. **Match Reminder Functionality Not Implemented**
**Location:** `src/components/FixtureCard.tsx:52`

**Issue:**
```typescript
// TODO: Implement actual reminder functionality
```

**Current State:** Button exists but doesn't do anything.

**Solution Required:**
1. Create reminders table
2. Implement reminder scheduling
3. Send notifications before match starts

```typescript
const handleSetReminder = async () => {
    await fetch('/api/reminders', {
        method: 'POST',
        body: JSON.stringify({
            matchId: match.id,
            userId: user.id,
            reminderTime: match.startTime - (15 * 60 * 1000) // 15 mins before
        })
    });
    
    // Schedule notification
    scheduleNotification({
        title: `Match Starting Soon!`,
        body: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        scheduledTime: match.startTime - (15 * 60 * 1000)
    });
};
```

**Estimated Time:** 4 hours  
**Priority:** P1 - User engagement feature

---

### 7. **Email Functionality Not Implemented**
**Location:** `src/app/api/auth/forgot-password/route.ts:60`

**Issue:**
```typescript
// TODO: Send email with reset link
```

**Current State:** Password reset generates token but doesn't send email.

**Solution Required:**
```typescript
import { sendEmail } from '@/lib/email';

// After generating reset token
await sendEmail({
    to: user.email,
    subject: 'Reset Your Password - Brix Sport',
    template: 'password-reset',
    data: {
        name: user.name,
        resetLink: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`,
        expiresIn: '1 hour'
    }
});
```

**Recommended Service:** Resend, SendGrid, or AWS SES

**Estimated Time:** 3 hours  
**Priority:** P1 - Required for password recovery

---

## 🟡 MEDIUM PRIORITY (P2)

### 8. **Stats Recalculation Not Triggered**
**Location:** `src/app/api/events/sync/route.ts:100`

**Issue:**
```typescript
// TODO: Trigger recalculation of ratings and stats
```

**Current State:** After syncing events, player/team stats are not automatically updated.

**Solution Required:**
```typescript
// After syncing events
await recalculateMatchStats(matchId);
await updatePlayerRatings(matchId);
await updateTeamStandings(match.competitionId);

async function recalculateMatchStats(matchId: string) {
    const events = await db.select()
        .from(matchEvents)
        .where(eq(matchEvents.matchId, matchId));
    
    // Calculate stats from events
    const stats = calculateStatsFromEvents(events);
    
    // Update match stats
    await db.update(matches)
        .set({ stats })
        .where(eq(matches.id, matchId));
}
```

**Estimated Time:** 4 hours  
**Priority:** P2 - Data accuracy

---

### 9. **Livestream Chat WebSocket Not Connected**
**Location:** `src/components/livestream/LivestreamChat.tsx:106`

**Issue:**
```typescript
// TODO: Send to WebSocket server
```

**Current State:** Chat UI exists but messages aren't sent via WebSocket.

**Solution Required:**
```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

const { emit } = useWebSocket({ matchId, autoConnect: true });

const handleSendMessage = () => {
    if (!message.trim()) return;
    
    emit('chat:message', {
        matchId,
        userId: user.id,
        userName: user.name,
        message: message.trim(),
        timestamp: Date.now()
    });
    
    setMessage('');
};
```

**Estimated Time:** 2 hours  
**Priority:** P2 - Engagement feature

---

### 10. **Hardcoded Admin ID in Transfers**
**Location:** `src/app/admin/transfers/page.tsx:189`

**Issue:**
```typescript
createdBy: 'admin-1', // TODO: Get from auth
```

**Solution Required:**
```typescript
import { useAuth } from '@/hooks/useAuth';

const { user } = useAuth();

// In form submission
createdBy: user?.id || 'system',
```

**Estimated Time:** 30 minutes  
**Priority:** P2 - Data integrity

---

## 📊 INCOMPLETE FEATURES

### 11. **Blog Enhancement - Phase 1 Not Integrated**
**Status:** ✅ Foundation Complete, ⚠️ Integration Pending

**What's Done:**
- ✅ Database schema enhancements
- ✅ Utility functions (SEO, ToC, Related Articles)
- ✅ React components (TableOfContents, ReadingProgress, etc.)

**What's Missing:**
1. **API Integration:** News API routes don't use new SEO fields
2. **Admin UI:** News editor doesn't have SEO metadata inputs
3. **Frontend:** News detail page doesn't use new components

**Files to Update:**
- `src/app/api/news/route.ts` - Add SEO field handling
- `src/app/admin/news/page.tsx` - Add SEO inputs
- `src/app/news/[slug]/page.tsx` - Integrate new components

**Estimated Time:** 6 hours  
**Priority:** P2 - Enhancement

**Reference:** See `BLOG_ENHANCEMENT_SUMMARY.md` lines 149-171

---

### 12. **Lineup Builder - Incomplete Publishing**
**Status:** ⚠️ UI Complete, Backend Partial

**What's Done:**
- ✅ Interactive pitch component
- ✅ Formation selection
- ✅ Player assignment UI

**What's Missing:**
1. **Publishing Endpoint:** `/api/lineups/publish` needs implementation
2. **Validation:** Formation validation incomplete
3. **Database:** Lineup persistence needs testing

**Files to Check:**
- `src/components/lineup/InteractivePitch.tsx` - UI complete
- `src/app/api/lineups/route.ts` - Needs publish endpoint

**Estimated Time:** 4 hours  
**Priority:** P2 - Feature completion

**Reference:** See `LINEUP_BUILDER_COMPLETE.md`

---

### 13. **Livestream Feature - Partially Implemented**
**Status:** ⚠️ UI Complete, Backend Incomplete

**What's Done:**
- ✅ LivestreamView component
- ✅ LivestreamPlayer component
- ✅ LivestreamChat UI
- ✅ Database schema

**What's Missing:**
1. **Chat Backend:** WebSocket chat server (see #9)
2. **Viewer Count:** Real-time viewer tracking
3. **Admin Panel:** Livestream management UI
4. **Highlights:** Event timestamp synchronization

**Files Affected:**
- `src/components/livestream/LivestreamChat.tsx:106` - Chat WebSocket
- `src/app/admin/livestreams/page.tsx` - Doesn't exist yet

**Estimated Time:** 8 hours  
**Priority:** P2 - Feature completion

**Reference:** See `LIVESTREAM_IMPLEMENTATION_PLAN.md`

---

## 🔧 HARDCODED DATA INSTANCES

### 14. **Livestream Warmup Time**
**Location:** `src/components/livestream/LivestreamView.tsx:282`

**Issue:**
```typescript
// Hardcoded "Warmup" assumption if no data (e.g. 10 mins)
```

**Solution:** Make configurable via match settings or competition rules.

---

### 15. **Mock Data Still Referenced**
**Location:** `src/lib/mock-data.ts`

**Status:** ✅ Deprecated but file still exists

**Issue:** File is marked as deprecated but still in codebase. Some imports may still reference it.

**Solution:** 
1. Search for any remaining imports: `grep -r "from '@/lib/mock-data'" src/`
2. Remove the file completely
3. Update any remaining references to use real data

**Estimated Time:** 1 hour  
**Priority:** P3 - Cleanup

---

### 16. **PDF Report Generation Placeholder**
**Location:** `src/lib/reports/matchReport.ts:288`

**Issue:**
```typescript
// This is a placeholder - install jsPDF for full implementation
```

**Current State:** Match reports can be generated but PDF export is not implemented.

**Solution Required:**
```bash
npm install jspdf jspdf-autotable
```

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generatePDFReport(report: MatchReport) {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text(report.title, 20, 20);
    
    // Add match info
    doc.setFontSize(12);
    doc.text(`${report.homeTeam} vs ${report.awayTeam}`, 20, 30);
    
    // Add stats table
    autoTable(doc, {
        head: [['Stat', 'Home', 'Away']],
        body: report.stats.map(s => [s.name, s.home, s.away]),
        startY: 40
    });
    
    // Save
    doc.save(`match-report-${report.matchId}.pdf`);
}
```

**Estimated Time:** 3 hours  
**Priority:** P3 - Enhancement

---

## 📈 FEATURE COMPLETION ROADMAP

### Phase 1: Security & Critical (Week 1)
**Priority:** P0 - Must complete before any production use

1. ✅ Implement password hashing (1 hour)
2. ✅ Implement JWT generation (2 hours)
3. ✅ Add admin authentication checks (1 hour)
4. ✅ Test authentication flow (2 hours)

**Total Time:** 6 hours

---

### Phase 2: Core Features (Week 2)
**Priority:** P1 - Required for full functionality

1. ✅ Implement push notification persistence (3 hours)
2. ✅ Implement WebSocket broadcasting (2 hours)
3. ✅ Implement email sending (3 hours)
4. ✅ Implement match reminders (4 hours)
5. ✅ Test real-time features (3 hours)

**Total Time:** 15 hours

---

### Phase 3: Feature Completion (Week 3)
**Priority:** P2 - Polish and complete features

1. ✅ Complete blog enhancement integration (6 hours)
2. ✅ Complete lineup builder publishing (4 hours)
3. ✅ Complete livestream chat backend (8 hours)
4. ✅ Implement stats recalculation (4 hours)
5. ✅ Testing and bug fixes (6 hours)

**Total Time:** 28 hours

---

### Phase 4: Cleanup & Enhancements (Week 4)
**Priority:** P3 - Nice to have

1. ✅ Remove mock data references (1 hour)
2. ✅ Implement PDF report generation (3 hours)
3. ✅ Fix hardcoded values (2 hours)
4. ✅ Code cleanup and documentation (4 hours)

**Total Time:** 10 hours

---

## 🎯 QUICK WINS (Can be done immediately)

### 1. Fix Hardcoded Admin ID
**File:** `src/app/admin/transfers/page.tsx:189`  
**Time:** 30 minutes  
**Impact:** Data integrity

### 2. Remove Mock Data File
**File:** `src/lib/mock-data.ts`  
**Time:** 1 hour  
**Impact:** Code cleanup

### 3. Add Missing Type Definitions
**Files:** Various  
**Time:** 2 hours  
**Impact:** Type safety

---

## 📝 RECOMMENDATIONS

### Immediate Actions (This Week)
1. **🔴 CRITICAL:** Implement password hashing before any logger accounts are created
2. **🔴 CRITICAL:** Add admin authentication to all admin endpoints
3. **🔴 CRITICAL:** Implement JWT token generation for logger auth

### Short Term (Next 2 Weeks)
1. Complete push notification persistence
2. Implement WebSocket broadcasting for real-time updates
3. Set up email service for password resets
4. Complete blog enhancement integration

### Long Term (Next Month)
1. Complete all P2 features
2. Implement comprehensive testing
3. Add monitoring and logging
4. Performance optimization

---

## 🔍 HOW TO VERIFY

### Check for TODOs
```bash
# Search for TODO comments
grep -r "TODO" src/ --include="*.ts" --include="*.tsx"
```

### Check for Hardcoded Values
```bash
# Search for hardcoded strings that should be configurable
grep -r "hardcoded\|placeholder\|mock" src/ --include="*.ts" --include="*.tsx" -i
```

### Check for Missing Implementations
```bash
# Search for incomplete functions
grep -r "Not implemented\|Coming soon\|WIP" src/ --include="*.ts" --include="*.tsx"
```

---

## 📚 RELATED DOCUMENTATION

- `SYSTEM_IMPROVEMENT_ROADMAP.md` - Comprehensive system improvements
- `BLOG_ENHANCEMENT_SUMMARY.md` - Blog feature status
- `LINEUP_BUILDER_COMPLETE.md` - Lineup builder status
- `LIVESTREAM_IMPLEMENTATION_PLAN.md` - Livestream feature plan
- `QUICK_START_GUIDE.md` - Feature usage guide

---

## ✅ COMPLETION CHECKLIST

### Security (P0)
- [ ] Password hashing implemented
- [ ] JWT generation implemented
- [ ] Admin authentication on all protected endpoints
- [ ] Security audit completed

### Core Features (P1)
- [ ] Push notifications persisted to database
- [ ] WebSocket broadcasting working
- [ ] Email service configured
- [ ] Match reminders functional
- [ ] Real-time updates tested

### Feature Completion (P2)
- [ ] Blog enhancement integrated
- [ ] Lineup builder publishing works
- [ ] Livestream chat backend complete
- [ ] Stats recalculation automated
- [ ] All features tested end-to-end

### Cleanup (P3)
- [ ] Mock data removed
- [ ] PDF reports working
- [ ] Hardcoded values eliminated
- [ ] Code documented
- [ ] No TODO comments remain

---

**Last Updated:** January 3, 2026  
**Next Review:** After Phase 1 completion  
**Maintained By:** Development Team
