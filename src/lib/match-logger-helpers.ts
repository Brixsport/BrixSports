import { db } from '@/db';
import { matchLoggerAssignments, loggers, matches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get all active loggers assigned to a match
 */
export async function getMatchLoggers(matchId: string) {
    const assignments = await db
        .select({
            assignment: matchLoggerAssignments,
            logger: loggers,
        })
        .from(matchLoggerAssignments)
        .leftJoin(loggers, eq(matchLoggerAssignments.loggerId, loggers.id))
        .where(
            and(
                eq(matchLoggerAssignments.matchId, matchId),
                eq(matchLoggerAssignments.status, 'active')
            )
        );

    return assignments
        .filter(a => a.logger !== null)
        .map(a => ({
            id: a.logger!.id,
            name: a.logger!.name,
            role: a.assignment.role,
            assignedAt: a.assignment.assignedAt,
        }));
}

/**
 * Get all matches assigned to a logger
 */
export async function getLoggerMatches(loggerId: string) {
    // Narrow projection — matches.stats/lineups are heavy JSON blobs that no real
    // consumer of assignedMatches reads (src/app/logger/page.tsx, src/app/admin/loggers/page.tsx
    // only use id/sport/homeTeamId/awayTeamId/status/startTime/competition/homeScore/awayScore).
    // A full-row spread here repeats those blobs once per assigned match, per logger,
    // on every /api/loggers/auth and /api/loggers/[id] response.
    const assignments = await db
        .select({
            assignment: matchLoggerAssignments,
            match: {
                id: matches.id,
                sport: matches.sport,
                homeTeamId: matches.homeTeamId,
                awayTeamId: matches.awayTeamId,
                homeScore: matches.homeScore,
                awayScore: matches.awayScore,
                status: matches.status,
                startTime: matches.startTime,
                competition: matches.competition,
            },
        })
        .from(matchLoggerAssignments)
        .leftJoin(matches, eq(matchLoggerAssignments.matchId, matches.id))
        .where(
            and(
                eq(matchLoggerAssignments.loggerId, loggerId),
                eq(matchLoggerAssignments.status, 'active')
            )
        );

    return assignments
        .filter(a => a.match !== null && a.match.id !== null)
        .map(a => ({
            ...a.match!,
            role: a.assignment.role,
            assignedAt: a.assignment.assignedAt,
        }));
}

/**
 * Check if a logger is assigned to a match
 */
export async function isLoggerAssigned(matchId: string, loggerId: string): Promise<boolean> {
    const result = await db
        .select()
        .from(matchLoggerAssignments)
        .where(
            and(
                eq(matchLoggerAssignments.matchId, matchId),
                eq(matchLoggerAssignments.loggerId, loggerId),
                eq(matchLoggerAssignments.status, 'active')
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Get the count of active loggers assigned to a match
 */
export async function getMatchLoggerCount(matchId: string): Promise<number> {
    const result = await db
        .select()
        .from(matchLoggerAssignments)
        .where(
            and(
                eq(matchLoggerAssignments.matchId, matchId),
                eq(matchLoggerAssignments.status, 'active')
            )
        );

    return result.length;
}

/**
 * Get the primary logger for a match (if any)
 */
export async function getPrimaryLogger(matchId: string) {
    const assignments = await db
        .select({
            assignment: matchLoggerAssignments,
            logger: loggers,
        })
        .from(matchLoggerAssignments)
        .leftJoin(loggers, eq(matchLoggerAssignments.loggerId, loggers.id))
        .where(
            and(
                eq(matchLoggerAssignments.matchId, matchId),
                eq(matchLoggerAssignments.status, 'active'),
                eq(matchLoggerAssignments.role, 'primary')
            )
        )
        .limit(1);

    if (assignments.length === 0 || !assignments[0].logger) {
        return null;
    }

    return {
        id: assignments[0].logger.id,
        name: assignments[0].logger.name,
        role: assignments[0].assignment.role,
        assignedAt: assignments[0].assignment.assignedAt,
    };
}
