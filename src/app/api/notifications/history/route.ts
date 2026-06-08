import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/db';
import { getAuthUser } from '@/lib/auth';

// In-memory store for notification history (replace with DB table in production)
let notificationHistory: any[] = [];

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Sort by most recent first
    const sorted = notificationHistory
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, 50); // Last 50 notifications

    return NextResponse.json({
      success: true,
      history: sorted,
      total: notificationHistory.length,
    });
  } catch (error) {
    console.error('[Notifications History] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    
    const historyEntry = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      sentAt: new Date().toISOString(),
    };

    notificationHistory.unshift(historyEntry);
    
    // Keep only last 100 entries
    if (notificationHistory.length > 100) {
      notificationHistory = notificationHistory.slice(0, 100);
    }

    return NextResponse.json({
      success: true,
      entry: historyEntry,
    });
  } catch (error) {
    console.error('[Notifications History] Error saving:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save history' },
      { status: 500 }
    );
  }
}
