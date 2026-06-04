import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { matches, matchEvents, playerStats, players, teams } from '../src/db/schema';
import { nanoid } from 'nanoid';
import { eq, and, or, like } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

async function backfillPastMatches(filePath: string) {
    let insertedMatches = 0;
    let processedPlayers = 0;
    let insertedEvents = 0;
    let skippedMatches = 0;
    let skippedPlayers = 0;

    console.log(`🚀 Starting backfill process using file: ${filePath}`);

    try {
        const ext = path.extname(filePath).toLowerCase();
        let rows: any[] = [];

        if (ext === '.xlsx') {
            const workbook = XLSX.readFile(filePath);
            const firstSheetName = workbook.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        } else if (ext === '.csv') {
            const content = fs.readFileSync(filePath, 'utf-8');
            rows = parse(content, { columns: true, skip_empty_lines: true });
        } else {
            throw new Error('Unsupported file extension. Only .csv and .xlsx are supported.');
        }

        console.log(`📄 Read ${rows.length} player rows from the file.`);

        // Group rows into matches by composite key: matchDate + homeTeamName + awayTeamName
        const groups: { [key: string]: any[] } = {};
        for (const row of rows) {
            const key = `${row.matchDate}_${row.homeTeamName}_${row.awayTeamName}`;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        }

        const groupKeys = Object.keys(groups);
        console.log(`⚽ Found ${groupKeys.length} distinct matches to process.`);

        for (const groupKey of groupKeys) {
            const playerRows = groups[groupKey];
            const firstRow = playerRows[0];

            try {
                const homeTeamName = firstRow.homeTeamName;
                const awayTeamName = firstRow.awayTeamName;
                const matchDate = firstRow.matchDate;
                const homeScore = parseInt(firstRow.homeScore, 10) || 0;
                const awayScore = parseInt(firstRow.awayScore, 10) || 0;
                const venue = firstRow.venue;
                const competition = firstRow.competition;
                const competitionId = firstRow.competitionId || null;
                const sport = firstRow.sport || 'Football';
                const matchType = firstRow.matchType || 'competition';

                console.log(`\n----------------------------------------`);
                console.log(`Processing Match: ${homeTeamName} vs ${awayTeamName} (${matchDate})`);

                // STEP 1 — RESOLVE TEAMS
                const homeTeam = await db.query.teams.findFirst({
                    where: like(teams.name, `%${homeTeamName}%`)
                });
                const awayTeam = await db.query.teams.findFirst({
                    where: like(teams.name, `%${awayTeamName}%`)
                });

                if (!homeTeam || !awayTeam) {
                    if (!homeTeam) {
                        console.warn(`⚠️ Warning: Home team "${homeTeamName}" not found in DB. Skipping match.`);
                    }
                    if (!awayTeam) {
                        console.warn(`⚠️ Warning: Away team "${awayTeamName}" not found in DB. Skipping match.`);
                    }
                    skippedMatches++;
                    continue;
                }

                // STEP 2 — INSERT MATCH ROW
                const newMatchId = nanoid();
                await db.insert(matches).values({
                    id: newMatchId,
                    sport: sport,
                    homeTeamId: homeTeam.id,
                    awayTeamId: awayTeam.id,
                    homeScore: homeScore,
                    awayScore: awayScore,
                    venue: venue,
                    competition: competition,
                    competitionId: competitionId,
                    matchType: matchType,
                    status: 'FINISHED',
                    approvalStatus: 'APPROVED',
                    startTime: matchDate,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                insertedMatches++;

                // STEP 3 — INSERT BACKFILL NOTE EVENT
                await db.insert(matchEvents).values({
                    id: nanoid(),
                    matchId: newMatchId,
                    type: 'note',
                    minute: 0,
                    detail: 'Match backfilled from physical log sheet — live timeline unavailable',
                    createdAt: new Date()
                });
                insertedEvents++;

                // STEP 4 — PROCESS EACH PLAYER ROW
                for (const playerRow of playerRows) {
                    try {
                        const playerName = playerRow.playerName;
                        const playerTeam = playerRow.playerTeam;
                        const resolvedTeamId = playerTeam === 'home' ? homeTeam.id : awayTeam.id;

                        // 4a) RESOLVE PLAYER
                        const player = await db.query.players.findFirst({
                            where: and(
                                like(players.name, `%${playerName}%`),
                                eq(players.teamId, resolvedTeamId)
                            )
                        });

                        if (!player) {
                            console.warn(`⚠️ Warning: Player "${playerName}" not found under team ID ${resolvedTeamId} (${playerTeam}). Skipping player row.`);
                            skippedPlayers++;
                            continue;
                        }

                        // 4b) INSERT MATCH EVENTS (one row per unit)
                        const eventMappings = [
                            { key: 'goals', type: 'Goal' },
                            { key: 'assists', type: 'Assist' },
                            { key: 'shotsOn', type: 'SHOT_ON_TARGET' },
                            { key: 'shotsOff', type: 'SHOT_OFF_TARGET' },
                            { key: 'yellowCards', type: 'Yellow Card' },
                            { key: 'redCards', type: 'Red Card' },
                            { key: 'tackles', type: 'TACKLE' },
                            { key: 'interceptions', type: 'INTERCEPTION' },
                            { key: 'clearances', type: 'CLEARANCE' },
                            { key: 'fouls', type: 'Foul' },
                            { key: 'saves', type: 'SAVE' },
                            { key: 'blocks', type: 'BLOCK' }
                        ];

                        for (const mapping of eventMappings) {
                            const rawVal = playerRow[mapping.key];
                            const count = rawVal ? parseInt(rawVal, 10) : 0;
                            if (!isNaN(count) && count > 0) {
                                for (let i = 0; i < count; i++) {
                                    await db.insert(matchEvents).values({
                                        id: nanoid(),
                                        matchId: newMatchId,
                                        type: mapping.type,
                                        minute: 0,
                                        playerId: player.id,
                                        teamId: resolvedTeamId,
                                        createdAt: new Date()
                                    });
                                    insertedEvents++;
                                }
                            }
                        }

                        // Substitution events
                        const subOutRaw = playerRow.subOut;
                        if (subOutRaw && subOutRaw.trim() !== '') {
                            const subOutMin = parseInt(subOutRaw, 10);
                            if (!isNaN(subOutMin)) {
                                await db.insert(matchEvents).values({
                                    id: nanoid(),
                                    matchId: newMatchId,
                                    type: 'Substitution',
                                    minute: subOutMin,
                                    detail: 'subbed off',
                                    playerId: player.id,
                                    teamId: resolvedTeamId,
                                    createdAt: new Date()
                                });
                                insertedEvents++;
                            }
                        }

                        const subInRaw = playerRow.subIn;
                        if (subInRaw && subInRaw.trim() !== '') {
                            const subInMin = parseInt(subInRaw, 10);
                            if (!isNaN(subInMin)) {
                                await db.insert(matchEvents).values({
                                    id: nanoid(),
                                    matchId: newMatchId,
                                    type: 'Substitution',
                                    minute: subInMin,
                                    detail: 'subbed on',
                                    playerId: player.id,
                                    teamId: resolvedTeamId,
                                    createdAt: new Date()
                                });
                                insertedEvents++;
                            }
                        }

                        // 4c) CALCULATE minutesPlayed
                        const subOutParsed = parseInt(subOutRaw, 10);
                        const subInParsed = parseInt(subInRaw, 10);
                        const outVal = !isNaN(subOutParsed) ? subOutParsed : 90;
                        const inVal = !isNaN(subInParsed) ? subInParsed : 0;
                        const minutesPlayed = Math.max(0, outVal - inVal);

                        // 4d) UPSERT playerStats
                        const existingStats = await db
                            .select()
                            .from(playerStats)
                            .where(
                                and(
                                    eq(playerStats.playerId, player.id),
                                    competitionId
                                        ? or(eq(playerStats.competitionId, competitionId), eq(playerStats.competition, competition || ''))
                                        : eq(playerStats.competition, competition || '')
                                )
                            )
                            .get();

                        const rowGoals = parseInt(playerRow.goals, 10) || 0;
                        const rowAssists = parseInt(playerRow.assists, 10) || 0;
                        const rowYellowCards = parseInt(playerRow.yellowCards, 10) || 0;
                        const rowRedCards = parseInt(playerRow.redCards, 10) || 0;
                        const rowSaves = parseInt(playerRow.saves, 10) || 0;
                        const rowRating = parseFloat(playerRow.rating || '7.0');
                        const finalRating = isNaN(rowRating) ? 7.0 : rowRating;

                        if (existingStats) {
                            const newAppearances = (existingStats.appearances || 0) + 1;
                            const oldAverageRating = existingStats.averageRating !== null && existingStats.averageRating !== undefined 
                                ? existingStats.averageRating 
                                : 7.0;
                            const newAverageRating = ((oldAverageRating * (existingStats.appearances || 0)) + finalRating) / newAppearances;

                            await db.update(playerStats)
                                .set({
                                    goals: (existingStats.goals || 0) + rowGoals,
                                    assists: (existingStats.assists || 0) + rowAssists,
                                    yellowCards: (existingStats.yellowCards || 0) + rowYellowCards,
                                    redCards: (existingStats.redCards || 0) + rowRedCards,
                                    saves: (existingStats.saves || 0) + rowSaves,
                                    appearances: newAppearances,
                                    minutesPlayed: (existingStats.minutesPlayed || 0) + minutesPlayed,
                                    averageRating: newAverageRating,
                                    updatedAt: new Date()
                                })
                                .where(eq(playerStats.id, existingStats.id));
                        } else {
                            await db.insert(playerStats).values({
                                id: nanoid(),
                                playerId: player.id,
                                competition: competition,
                                competitionId: competitionId,
                                sport: sport,
                                goals: rowGoals,
                                assists: rowAssists,
                                yellowCards: rowYellowCards,
                                redCards: rowRedCards,
                                saves: rowSaves,
                                appearances: 1,
                                minutesPlayed: minutesPlayed,
                                averageRating: finalRating,
                                updatedAt: new Date()
                            });
                        }

                        processedPlayers++;
                    } catch (playerErr) {
                        console.error(`❌ DB error processing player ${playerRow.playerName}:`, playerErr);
                        skippedPlayers++;
                    }
                }

                // STEP 5 — COMPUTE AND UPDATE MATCH STATS JSON
                const homeStats = {
                    possession: 0,
                    shots: 0,
                    shotsOnTarget: 0,
                    corners: 0,
                    fouls: 0,
                    yellowCards: 0,
                    redCards: 0,
                    saves: 0,
                    passAccuracy: 0,
                    tackles: 0,
                    interceptions: 0,
                    offsides: 0
                };

                const awayStats = {
                    possession: 0,
                    shots: 0,
                    shotsOnTarget: 0,
                    corners: 0,
                    fouls: 0,
                    yellowCards: 0,
                    redCards: 0,
                    saves: 0,
                    passAccuracy: 0,
                    tackles: 0,
                    interceptions: 0,
                    offsides: 0
                };

                for (const pr of playerRows) {
                    const isHome = pr.playerTeam === 'home';
                    const target = isHome ? homeStats : awayStats;

                    const sOn = parseInt(pr.shotsOn, 10) || 0;
                    const sOff = parseInt(pr.shotsOff, 10) || 0;

                    target.shots += (sOn + sOff);
                    target.shotsOnTarget += sOn;
                    target.fouls += parseInt(pr.fouls, 10) || 0;
                    target.yellowCards += parseInt(pr.yellowCards, 10) || 0;
                    target.redCards += parseInt(pr.redCards, 10) || 0;
                    target.saves += parseInt(pr.saves, 10) || 0;
                    target.tackles += parseInt(pr.tackles, 10) || 0;
                    target.interceptions += parseInt(pr.interceptions, 10) || 0;
                }

                const statsObject = {
                    home: homeStats,
                    away: awayStats
                };

                await db.update(matches)
                    .set({
                        stats: JSON.stringify(statsObject),
                        updatedAt: new Date()
                    })
                    .where(eq(matches.id, newMatchId));

                console.log(`✅ Successfully backfilled Match ID: ${newMatchId}`);

            } catch (matchErr) {
                console.error(`❌ DB error processing match group ${groupKey}:`, matchErr);
                skippedMatches++;
            }
        }
    } catch (fileErr) {
        console.error('❌ Fatal error reading or parsing the file:', fileErr);
        throw fileErr;
    }

    console.log('\n--- Backfill Summary ---');
    console.log(`✅ Matches inserted: ${insertedMatches}`);
    console.log(`✅ Players processed: ${processedPlayers}`);
    console.log(`✅ Events inserted: ${insertedEvents}`);
    console.log(`⚠️  Matches skipped (team not found): ${skippedMatches}`);
    console.log(`⚠️  Players skipped (not found): ${skippedPlayers}`);
}

if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error(
            'Usage: npx tsx scripts/backfill-past-matches.ts <path-to-file.csv|xlsx>\n' +
            '   or  bun run scripts/backfill-past-matches.ts <path-to-file.csv|xlsx>'
        );
        process.exit(1);
    }
    backfillPastMatches(filePath)
        .then(() => process.exit(0))
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}

export { backfillPastMatches };
