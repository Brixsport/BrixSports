/**
 * Sport-keyed notification rules — single source of truth for which raw event
 * types and period transitions are notifiable, per sport.
 *
 * Replaces what was, until this refactor, a football-shaped structure basketball
 * was quietly sharing (a flat `Record<string, NotificationKey>` with no sport
 * check at all) — see NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md thread 5/7. That
 * shape is why basketball's MATCH_END started firing unintentionally the moment
 * Phase 1's period mapping shipped (thread 3): a generic `FINISHED -> MATCH_END`
 * rule had no way to know it was about to apply to a second sport. Here, each
 * sport's rules are their own explicit table entries, so a new sport (Track is
 * the next candidate, per thread 7) adds a sibling entry rather than a second
 * `if`-chain or a widened flat map that has to stay in sync with the loggers.
 *
 * `NotificationKey` intentionally stays a closed union, not a fully open string:
 * every key here must have a matching case in `createNotificationPayload()`
 * (src/lib/notifications/match-notification-service.ts), so widening it without
 * a template is a silent no-op notification, not a type error.
 */

export type NotificationKey =
    | 'MATCH_START'
    | 'MATCH_STARTING_SOON'
    | 'GOAL'
    | 'RED_CARD'
    | 'YELLOW_CARD'
    | 'LINEUP_AVAILABLE'
    | 'MATCH_END'
    | 'HALF_TIME'
    | 'PENALTY_SAVED'
    | 'PENALTY_MISSED'
    | 'TECHNICAL_FOUL';

interface SportNotificationRules {
    // Raw matchEvents.type -> notification key.
    events: Record<string, NotificationKey>;
    // Raw matches.currentPeriod -> notification key, for period-transition (not
    // per-event) notifications like kickoff/halftime/full-time.
    periods: Record<string, NotificationKey>;
}

export const NOTIFICATION_RULES: Record<string, SportNotificationRules> = {
    Football: {
        events: {
            'Goal': 'GOAL',
            'Penalty': 'GOAL',
            'Red Card': 'RED_CARD',
            'Yellow Card': 'YELLOW_CARD',
            'Penalty Saved': 'PENALTY_SAVED',
            'Penalty Missed': 'PENALTY_MISSED',
        },
        periods: {
            'FIRST_HALF': 'MATCH_START',
            'HALF_TIME': 'HALF_TIME',
            'FINISHED': 'MATCH_END',
        },
    },
    Basketball: {
        // Deliberately minimal (BACKLOG-203, spam-aware): every routine scoring/foul
        // type (Field Goal, Three Pointer, Free Throw, Rebound, Assist, Steal, Block,
        // Turnover, plain Foul, Substitution, Timeout) is intentionally excluded — see
        // NOTIFICATION_SYSTEM_ROADMAP_PROPOSAL.md thread 3.
        events: {
            'Technical Foul': 'TECHNICAL_FOUL',
        },
        periods: {
            'Q1': 'MATCH_START',
            'Q3': 'HALF_TIME',
            'FINISHED': 'MATCH_END',
        },
    },
};

export function getNotifiableEventType(sport: string, dbEventType: string): NotificationKey | undefined {
    return NOTIFICATION_RULES[sport]?.events[dbEventType];
}

export function getNotifiablePeriodType(sport: string, period: string): NotificationKey | undefined {
    return NOTIFICATION_RULES[sport]?.periods[period];
}
