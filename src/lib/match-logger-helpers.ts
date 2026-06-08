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
    const assignments = await db
        .select({
            assignment: matchLoggerAssignments,
            match: matches,
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
        .filter(a => a.match !== null)
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
