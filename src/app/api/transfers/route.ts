import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { transfers, players, teams } from '@/db/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { getAuthUser } from '@/lib/auth';

// GET /api/transfers - Get all transfers with filters
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const transferType = searchParams.get('type');
        const teamId = searchParams.get('teamId');
        const playerId = searchParams.get('playerId');
        const season = searchParams.get('season');
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20), 100);
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build query conditions
        const conditions = [];

        if (status) {
            conditions.push(eq(transfers.status, status));
        }

        if (transferType) {
            conditions.push(eq(transfers.transferType, transferType));
        }

        if (teamId) {
            conditions.push(
                or(
                    eq(transfers.fromTeamId, teamId),
                    eq(transfers.toTeamId, teamId)
                )
            );
        }

        if (playerId) {
            conditions.push(eq(transfers.playerId, playerId));
        }

        if (season) {
            conditions.push(eq(transfers.season, season));
        }

        // Fetch transfers with proper aliases
        const fromTeamAlias = db.select().from(teams).as('fromTeam');
        const toTeamAlias = db.select().from(teams).as('toTeam');

        const transfersList = await db
            .select({
                id: transfers.id,
                playerId: transfers.playerId,
                fromTeamId: transfers.fromTeamId,
                toTeamId: transfers.toTeamId,
                transferType: transfers.transferType,
                fee: transfers.fee,
                status: transfers.status,
                reliability: transfers.reliability,
                source: transfers.source,
                description: transfers.description,
                imageUrl: transfers.imageUrl,
                season: transfers.season,
                announcedAt: transfers.announcedAt,
                completedAt: transfers.completedAt,
                createdAt: transfers.createdAt,
                createdBy: transfers.createdBy,
                player: players,
            })
            .from(transfers)
            .leftJoin(players, eq(transfers.playerId, players.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(transfers.announcedAt), desc(transfers.createdAt))
            .limit(limit)
            .offset(offset);

        // Fetch team details separately to avoid alias conflicts
        const formattedTransfers = await Promise.all(
            transfersList.map(async (t: any) => {
                const fromTeam = t.fromTeamId
                    ? await db.select().from(teams).where(eq(teams.id, t.fromTeamId)).limit(1)
                    : null;
                const toTeam = t.toTeamId
                    ? await db.select().from(teams).where(eq(teams.id, t.toTeamId)).limit(1)
                    : null;

                return {
                    id: t.id,
                    fromTeamId: t.fromTeamId,
                    toTeamId: t.toTeamId,
                    transferType: t.transferType,
                    fee: t.fee,
                    status: t.status,
                    reliability: t.reliability,
                    source: t.source,
                    description: t.description,
                    imageUrl: t.imageUrl,
                    season: t.season,
                    announcedAt: t.announcedAt,
                    completedAt: t.completedAt,
                    createdAt: t.createdAt,
                    player: t.player ? {
                        id: t.player.id,
                        name: t.player.name,
                        jerseyName: t.player.jerseyName,
                        number: t.player.number,
                        position: t.player.position,
                        image: t.player.image,
                    } : null,
                    fromTeam: fromTeam?.[0] || null,
                    toTeam: toTeam?.[0] || null,
                };
            })
        );

        // Get total count
        const totalCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(transfers)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        return NextResponse.json({
            transfers: formattedTransfers,
            pagination: {
                total: totalCount[0]?.count || 0,
                limit,
                offset,
                hasMore: (offset + limit) < (totalCount[0]?.count || 0),
            },
        });
    } catch (error) {
        console.error('[Transfers API] Error fetching transfers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transfers' },
            { status: 500 }
        );
    }
}

// POST /api/transfers - Create new transfer (Admin only)
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const {
            playerId,
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

        // Validate required fields
        if (!playerId || !transferType) {
            return NextResponse.json(
                { error: 'Missing required fields: playerId, transferType' },
                { status: 400 }
            );
        }

        const createdBy = authUser.id;

        // Verify player exists
        const player = await db
            .select()
            .from(players)
            .where(eq(players.id, playerId))
            .limit(1);

        if (!player || player.length === 0) {
            return NextResponse.json(
                { error: 'Player not found' },
                { status: 404 }
            );
        }

        // Create transfer
        const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newTransfer = await db.insert(transfers).values({
            id: transferId,
            playerId,
            fromTeamId: fromTeamId || null,
            toTeamId: toTeamId || null,
            transferType,
            fee: fee || null,
            status: status || 'rumor',
            reliability: reliability || 5,
            source: source || null,
            description: description || null,
            imageUrl: imageUrl || null,
            sendPushNotification: sendPushNotification || false,
            createdBy,
            season: season || new Date().getFullYear().toString(),
            announcedAt: status === 'confirmed' || status === 'completed' ? new Date() : null,
            completedAt: status === 'completed' ? new Date() : null,
        }).returning();

        // If sendPushNotification is true and status is confirmed/completed, trigger notification
        if (sendPushNotification && (status === 'confirmed' || status === 'completed')) {
            try {
                const fromTeam = fromTeamId ? await db.select().from(teams).where(eq(teams.id, fromTeamId)).limit(1) : null;
                const toTeam = toTeamId ? await db.select().from(teams).where(eq(teams.id, toTeamId)).limit(1) : null;

                const notificationTitle = status === 'completed'
                    ? `✅ TRANSFER COMPLETE: ${player[0].name}`
                    : `🔄 TRANSFER: ${player[0].name}`;

                const notificationBody = `${player[0].name} ${fromTeam?.[0] ? `from ${fromTeam[0].name}` : ''} ${toTeam?.[0] ? `to ${toTeam[0].name}` : ''}`;

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
                        transferId,
                        title: notificationTitle,
                        body: notificationBody,
                        icon: imageUrl || player[0].image,
                        url: `/transfers/${transferId}`,
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
                    .where(eq(transfers.id, transferId));
            } catch (err) {
                console.error('[Transfers API] Failed to send push notification:', err);
                // Don't fail the transfer creation if notification fails
            }
        }

        return NextResponse.json({
            success: true,
            transfer: newTransfer[0],
        }, { status: 201 });
    } catch (error) {
        console.error('[Transfers API] Error creating transfer:', error);
        return NextResponse.json(
            { error: 'Failed to create transfer' },
            { status: 500 }
        );
    }
}
