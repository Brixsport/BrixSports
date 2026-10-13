import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { advertisements } from '@/db/schema';
import { eq, and, or, isNull, gte, lte, desc } from 'drizzle-orm';
import { isFeatureEnabled } from '@/lib/featureFlags';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || 'inline';

    if (!(await isFeatureEnabled('features.ads.enabled'))) {
      return NextResponse.json({ success: false, message: 'No active ads found' });
    }

    // The date columns use timestamp mode, so compare against a Date and let
    // Drizzle convert it to the stored unit.
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
          or(isNull(advertisements.startDate), lte(advertisements.startDate, now)),
          or(isNull(advertisements.endDate), gte(advertisements.endDate, now))
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
        impressions: (ad.impressions ?? 0) + 1,
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
