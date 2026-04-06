import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { advertisements } from '@/db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

// Initialize database
const sqlite = new Database('local.db');
const db = drizzle(sqlite);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || 'inline';

    // Get current timestamp
    const now = new Date();

    // Find active ads for this position
    // Active means: status = 'active', (startDate is null OR startDate <= now), (endDate is null OR endDate >= now)
    const activeAds = await db
      .select()
      .from(advertisements)
      .where(
        and(
          eq(advertisements.position, position),
          eq(advertisements.status, 'active'),
          sql`${advertisements.startDate} IS NULL OR ${advertisements.startDate} <= ${now.getTime()}`,
          sql`${advertisements.endDate} IS NULL OR ${advertisements.endDate} >= ${now.getTime()}`
        )
      )
      .orderBy(desc(advertisements.priority))
      .limit(1);

    if (activeAds.length === 0) {
      return NextResponse.json({ success: false, message: 'No active ads found' });
    }

    const ad = activeAds[0];

    // Increment impressions
    await db
      .update(advertisements)
      .set({
        impressions: ad.impressions + 1,
      })
      .where(eq(advertisements.id, ad.id));

    return NextResponse.json({
      success: true,
      ad: {
        id: ad.id,
        title: ad.title,
        imageUrl: ad.imageUrl,
        linkUrl: ad.linkUrl,
        position: ad.position,
        size: ad.size,
      },
    });
  } catch (error) {
    console.error('Error fetching ad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch advertisement' },
      { status: 500 }
    );
  }
}
