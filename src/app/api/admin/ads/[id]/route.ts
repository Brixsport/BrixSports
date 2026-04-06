import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { advertisements } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Initialize database
const sqlite = new Database('local.db');
const db = drizzle(sqlite);

// PUT /api/admin/ads/[id] - Update advertisement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.linkUrl !== undefined) updateData.linkUrl = body.linkUrl;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.size !== undefined) updateData.size = body.size;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.startDate !== undefined) updateData.startDate = body.startDate;
    if (body.endDate !== undefined) updateData.endDate = body.endDate;

    await db
      .update(advertisements)
      .set(updateData)
      .where(eq(advertisements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating advertisement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update advertisement' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ads/[id] - Delete advertisement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db
      .delete(advertisements)
      .where(eq(advertisements.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting advertisement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete advertisement' },
      { status: 500 }
    );
  }
}
