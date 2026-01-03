import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fplTransfers, fplTeams, fplTeamSelections, fplPlayerData, fplGameweeks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/fpl/transfers - Get transfer history
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const gameweekId = searchParams.get('gameweekId');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!teamId) {
            return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
        }

        const whereConditions = [eq(fplTransfers.teamId, teamId)];

        if (gameweekId) {
            whereConditions.push(eq(fplTransfers.gameweekId, gameweekId));
        }

        const transfers = await db.query.fplTransfers.findMany({
            where: and(...whereConditions),
            orderBy: [desc(fplTransfers.createdAt)],
            limit,
        });

        return NextResponse.json(transfers);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
    }
}

// POST /api/fpl/transfers - Make a transfer
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { teamId, playerInId, playerOutId, isWildcard = false, isFreeHit = false } = body;

        if (!teamId || !playerInId || !playerOutId) {
            return NextResponse.json(
                { error: 'Team ID, player in, and player out are required' },
                { status: 400 }
            );
        }

        // Get team
        const team = await db.query.fplTeams.findFirst({
            where: eq(fplTeams.id, teamId),
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Get current gameweek
        const currentGameweek = await db.query.fplGameweeks.findFirst({
            where: and(
                eq(fplGameweeks.season, team.season),
                eq(fplGameweeks.isActive, true)
            ),
        });

        if (!currentGameweek) {
            return NextResponse.json({ error: 'No active gameweek' }, { status: 400 });
        }

        // Check if deadline has passed
        if (new Date() > currentGameweek.deadlineDate) {
            return NextResponse.json(
                { error: 'Transfer deadline has passed for this gameweek' },
                { status: 400 }
            );
        }

        // Get player data
        const playerIn = await db.query.fplPlayerData.findFirst({
            where: and(
                eq(fplPlayerData.playerId, playerInId),
                eq(fplPlayerData.season, team.season)
            ),
        });

        const playerOut = await db.query.fplPlayerData.findFirst({
            where: and(
                eq(fplPlayerData.playerId, playerOutId),
                eq(fplPlayerData.season, team.season)
            ),
        });

        if (!playerIn || !playerOut) {
            return NextResponse.json({ error: 'Player not found' }, { status: 404 });
        }

        // Check if player is available
        if (!playerIn.isAvailable) {
            return NextResponse.json(
                { error: `${playerIn.playerId} is not available` },
                { status: 400 }
            );
        }

        // Get current selection for player out
        const currentSelection = await db.query.fplTeamSelections.findFirst({
            where: and(
                eq(fplTeamSelections.teamId, teamId),
                eq(fplTeamSelections.playerId, playerOutId),
                eq(fplTeamSelections.gameweekId, currentGameweek.id)
            ),
        });

        if (!currentSelection) {
            return NextResponse.json(
                { error: 'Player to remove is not in your squad' },
                { status: 400 }
            );
        }

        // Check budget
        const priceDifference = playerIn.price - playerOut.price;
        if (priceDifference > (team.bankBalance ?? 0)) {
            return NextResponse.json(
                { error: `Insufficient funds. Need £${priceDifference}m more` },
                { status: 400 }
            );
        }

        // Calculate points cost
        let pointsCost = 0;
        let isFreeTransfer = true;
        let transferType = 'normal';

        if (isWildcard) {
            transferType = 'wildcard';
            isFreeTransfer = true;
        } else if (isFreeHit) {
            transferType = 'free_hit';
            isFreeTransfer = true;
        } else if ((team.freeTransfers ?? 0) <= 0) {
            pointsCost = -4;
            isFreeTransfer = false;
        }

        // Create transfer record
        const transferId = `fpl_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(fplTransfers).values({
            id: transferId,
            teamId,
            gameweekId: currentGameweek.id,
            playerInId,
            playerOutId,
            playerInPrice: playerIn.price,
            playerOutPrice: playerOut.price,
            isFreeTransfer,
            pointsCost,
            transferType,
        });

        // Update team selection - remove old player
        await db.delete(fplTeamSelections)
            .where(eq(fplTeamSelections.id, currentSelection.id));

        // Add new player
        const newSelectionId = `fpl_sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(fplTeamSelections).values({
            id: newSelectionId,
            teamId,
            playerId: playerInId,
            gameweekId: currentGameweek.id,
            position: currentSelection.position,
            isCaptain: currentSelection.isCaptain,
            isViceCaptain: currentSelection.isViceCaptain,
            multiplier: currentSelection.multiplier,
            purchasePrice: playerIn.price,
        });

        // Update team stats
        const newBankBalance = (team.bankBalance ?? 0) - priceDifference;
        const newFreeTransfers = isWildcard || isFreeHit ? (team.freeTransfers ?? 1) : Math.max(0, (team.freeTransfers ?? 1) - 1);
        const newTransfersMade = (team.transfersMade ?? 0) + 1;
        const newPointsDeducted = (team.pointsDeducted ?? 0) + Math.abs(pointsCost);

        await db.update(fplTeams)
            .set({
                bankBalance: newBankBalance,
                freeTransfers: newFreeTransfers,
                transfersMade: newTransfersMade,
                pointsDeducted: newPointsDeducted,
                wildcardUsed: isWildcard ? true : team.wildcardUsed,
                wildcardGameweek: isWildcard ? currentGameweek.number : team.wildcardGameweek,
                freeHitUsed: isFreeHit ? true : team.freeHitUsed,
                freeHitGameweek: isFreeHit ? currentGameweek.number : team.freeHitGameweek,
                updatedAt: new Date(),
            })
            .where(eq(fplTeams.id, teamId));

        // Update player transfer stats
        await db.update(fplPlayerData)
            .set({
                transfersIn: (playerIn.transfersIn ?? 0) + 1,
                selectedBy: (playerIn.selectedBy ?? 0) + 1,
            })
            .where(eq(fplPlayerData.id, playerIn.id));

        await db.update(fplPlayerData)
            .set({
                transfersOut: (playerOut.transfersOut ?? 0) + 1,
                selectedBy: Math.max(0, (playerOut.selectedBy ?? 0) - 1),
            })
            .where(eq(fplPlayerData.id, playerOut.id));

        const transfer = await db.query.fplTransfers.findFirst({
            where: eq(fplTransfers.id, transferId),
        });

        return NextResponse.json({
            transfer,
            pointsCost,
            newBankBalance,
            message: isFreeTransfer ? 'Free transfer completed' : `Transfer completed (-4 points)`,
        }, { status: 201 });
    } catch (error) {
        console.error('Error making transfer:', error);
        return NextResponse.json({ error: 'Failed to make transfer' }, { status: 500 });
    }
}
