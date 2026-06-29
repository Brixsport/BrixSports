/**
 * User Favorites API
 * Manage user favorites (teams, players, matches, competitions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userFavorites, teams, players, matches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthUser, resolveEffectiveUserId } from '@/lib/auth';

/**
 * GET user's favorites
 * GET /api/users/favorites?type=competition
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'team' | 'player' | 'match' | 'competition'

        // Build query
        let favoritesData;

        if (type) {
            favoritesData = await db
                .select()
                .from(userFavorites)
                .where(
                    and(
                        eq(userFavorites.userId, effectiveId),
                        eq(userFavorites.favoriteType, type)
                    )
                );
        } else {
            favoritesData = await db
                .select()
                .from(userFavorites)
                .where(eq(userFavorites.userId, effectiveId));
        }

        const favorites = favoritesData;

        // Fetch full details for each favorite
        const favoritesWithDetails = await Promise.all(
            favorites.map(async (fav) => {
                let details = null;

                switch (fav.favoriteType) {
                    case 'competition':
                        // Competitions are text fields, return the name
                        details = { name: fav.favoriteId, type: 'competition' };
                        break;
                    case 'team':
                        const teamData = await db
                            .select()
                            .from(teams)
                            .where(eq(teams.id, fav.favoriteId))
                            .limit(1);
                        details = teamData[0] || null;
                        break;
                    case 'player':
                        const playerData = await db
                            .select()
                            .from(players)
                            .where(eq(players.id, fav.favoriteId))
                            .limit(1);
                        details = playerData[0] || null;
                        break;
                    case 'match':
                        const matchData = await db
                            .select()
                            .from(matches)
                            .where(eq(matches.id, fav.favoriteId))
                            .limit(1);
                        details = matchData[0] || null;
                        break;
                }

                return {
                    ...fav,
                    details,
                };
            })
        );

        return NextResponse.json({
            favorites: favoritesWithDetails,
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch favorites' },
            { status: 500 }
        );
    }
}

/**
 * ADD favorite
 * POST /api/users/favorites
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);
        const body = await request.json();
        const { favoriteType, favoriteId } = body;

        if (!favoriteType || !favoriteId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if already favorited
        const existing = await db
            .select()
            .from(userFavorites)
            .where(
                and(
                    eq(userFavorites.userId, effectiveId),
                    eq(userFavorites.favoriteType, favoriteType),
                    eq(userFavorites.favoriteId, favoriteId)
                )
            );

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Already favorited' },
                { status: 400 }
            );
        }

        // Create favorite
        const favoriteIdStr = `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await db.insert(userFavorites).values({
            id: favoriteIdStr,
            userId: effectiveId,
            favoriteType,
            favoriteId,
        });

        return NextResponse.json({
            success: true,
            favoriteId: favoriteIdStr,
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding favorite:', error);
        return NextResponse.json(
            { error: 'Failed to add favorite' },
            { status: 500 }
        );
    }
}

/**
 * REMOVE favorite
 * DELETE /api/users/favorites
 */
export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const effectiveId = await resolveEffectiveUserId(user);
        const { searchParams } = new URL(request.url);
        const favoriteType = searchParams.get('type');
        const favoriteId = searchParams.get('id');

        if (!favoriteType || !favoriteId) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // Delete favorite
        await db
            .delete(userFavorites)
            .where(
                and(
                    eq(userFavorites.userId, effectiveId),
                    eq(userFavorites.favoriteType, favoriteType),
                    eq(userFavorites.favoriteId, favoriteId)
                )
            );

        return NextResponse.json({
            success: true,
            message: 'Favorite removed',
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        return NextResponse.json(
            { error: 'Failed to remove favorite' },
            { status: 500 }
        );
    }
}
