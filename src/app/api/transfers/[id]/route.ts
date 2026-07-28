import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transfers, players, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// GET /api/transfers/[id] - Get single transfer with full details
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Fetch transfer with related data
        const transferData = await db
            .select({
                transfer: transfers,
                player: players,
            })
            .from(transfers)
            .leftJoin(players, eq(transfers.playerId, players.id))
            .where(eq(transfers.id, id))
            .limit(1);

        if (!transferData || transferData.length === 0) {
            return NextResponse.json(
                { error: 'Transfer not found' },
                { status: 404 }
            );
        }

        const transfer = transferData[0].transfer;
        const player = transferData[0].player;

        // Fetch teams separately
        let fromTeam = null;
        let toTeam = null;

        if (transfer.fromTeamId) {
            const fromTeamData = await db
                .select()
                .from(teams)
                .where(eq(teams.id, transfer.fromTeamId))
                .limit(1);
            fromTeam = fromTeamData[0] || null;
        }

        if (transfer.toTeamId) {
            const toTeamData = await db
                .select()
                .from(teams)
                .where(eq(teams.id, transfer.toTeamId))
                .limit(1);
            toTeam = toTeamData[0] || null;
        }

        return NextResponse.json({
            ...transfer,
            player,
            fromTeam,
            toTeam,
        });
    } catch (error) {
        console.error('[Transfers API] Error fetching transfer:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transfer' },
            { status: 500 }
        );
    }
}

// PATCH /api/transfers/[id] - Update transfer (Admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = params;
        const body = await request.json();

        const {
            fromTeamId,
            toTeamId,
            transferType,
            fee,
            status,
            reliability,
            source,
            description,
            imageUrl,
            sendPushNotification,
            season,
        } = body;

        // Build update object
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (fromTeamId !== undefined) updateData.fromTeamId = fromTeamId;
        if (toTeamId !== undefined) updateData.toTeamId = toTeamId;
        if (transferType) updateData.transferType = transferType;
        if (fee !== undefined) updateData.fee = fee;
        if (status) {
            updateData.status = status;
            if ((status === 'confirmed' || status === 'completed') && !updateData.announcedAt) {
                updateData.announcedAt = new Date();
            }
            if (status === 'completed' && !updateData.completedAt) {
                updateData.completedAt = new Date();
            }
        }
        if (reliability !== undefined) updateData.reliability = reliability;
        if (source !== undefined) updateData.source = source;
        if (description !== undefined) updateData.description = description;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (season) updateData.season = season;

        // Update transfer
        const updated = await db
            .update(transfers)
            .set(updateData)
            .where(eq(transfers.id, id))
            .returning();

        if (!updated || updated.length === 0) {
            return NextResponse.json(
                { error: 'Transfer not found' },
                { status: 404 }
            );
        }

        // Send push notification if requested and status is confirmed/completed
        if (sendPushNotification && (status === 'confirmed' || status === 'completed')) {
            try {
                const transfer = updated[0];

                // Fetch player and teams for notification
                const player = await db.select().from(players).where(eq(players.id, transfer.playerId)).limit(1);
                const fromTeam = transfer.fromTeamId ? await db.select().from(teams).where(eq(teams.id, transfer.fromTeamId)).limit(1) : null;
                const toTeam = transfer.toTeamId ? await db.select().from(teams).where(eq(teams.id, transfer.toTeamId)).limit(1) : null;

                const notificationTitle = status === 'completed'
                    ? `✅ TRANSFER COMPLETE: ${player[0]?.name}`
                    : `🔄 TRANSFER: ${player[0]?.name}`;

                const notificationBody = `${player[0]?.name} ${fromTeam?.[0] ? `from ${fromTeam[0].name}` : ''} ${toTeam?.[0] ? `to ${toTeam[0].name}` : ''}`;

                console.log('[Transfers API] Sending push notification...');
                const notificationResponse = await fetch(`${request.nextUrl.origin}/api/notifications/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // /api/notifications/send is admin-gated (BUG-147); forward the
                        // already-verified admin's cookie for this server-to-server call.
                        cookie: request.headers.get('cookie') || '',
                    },
                    body: JSON.stringify({
                        type: 'transfer',
                        transferId: transfer.id,
                        title: notificationTitle,
                        body: notificationBody,
                        icon: transfer.imageUrl || player[0]?.image,
                        url: `/transfers/${transfer.id}`,
                    }),
                });

                if (!notificationResponse.ok) {
                    const errorData = await notificationResponse.json().catch(() => ({}));
                    console.error('[Transfers API] Push notification failed:', {
                        status: notificationResponse.status,
                        error: errorData.error || 'Unknown error'
                    });
                } else {
                    const result = await notificationResponse.json();
                    console.log('[Transfers API] Push notification sent successfully:', result);
                }

                // Update notification sent status
                await db.update(transfers)
                    .set({
                        pushNotificationSent: true,
                        pushNotificationSentAt: new Date(),
                    })
                    .where(eq(transfers.id, id));
            } catch (err) {
                console.error('[Transfers API] Failed to send push notification:', err);
                // Don't fail the transfer update if notification fails
            }
        }

        return NextResponse.json({
            success: true,
            transfer: updated[0],
        });
    } catch (error) {
        console.error('[Transfers API] Error updating transfer:', error);
        return NextResponse.json(
            { error: 'Failed to update transfer' },
            { status: 500 }
        );
    }
}

// DELETE /api/transfers/[id] - Delete transfer (Admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = params;

        // Delete transfer
        const deleted = await db
            .delete(transfers)
            .where(eq(transfers.id, id))
            .returning();

        if (!deleted || deleted.length === 0) {
            return NextResponse.json(
                { error: 'Transfer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Transfer deleted successfully',
        });
    } catch (error) {
        console.error('[Transfers API] Error deleting transfer:', error);
        return NextResponse.json(
            { error: 'Failed to delete transfer' },
            { status: 500 }
        );
    }
}
