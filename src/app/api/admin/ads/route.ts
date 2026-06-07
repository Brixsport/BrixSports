import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { advertisements } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthUser } from '@/lib/auth';

// GET /api/admin/ads - List all advertisements
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ads = await db
      .select()
      .from(advertisements)
      .orderBy(desc(advertisements.priority), desc(advertisements.createdAt));

    return NextResponse.json({ success: true, ads });
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch advertisements' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ads - Create new advertisement
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const newAd = {
      id: nanoid(),
      title: body.title,
      description: body.description || null,
      imageUrl: body.imageUrl,
      linkUrl: body.linkUrl,
      position: body.position || 'inline',
      size: body.size || 'small',
      status: body.status || 'active',
      priority: body.priority || 0,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      impressions: 0,
      clicks: 0,
      createdBy: authUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(advertisements).values(newAd);

    return NextResponse.json({ success: true, ad: newAd });
  } catch (error) {
    console.error('Error creating advertisement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create advertisement' },
      { status: 500 }
    );
  }
}
