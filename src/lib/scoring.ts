// Shared between events/route.ts (POST, credits score) and events/[eventId]/route.ts
// (DELETE, reverts score) — BUG-129/known-issues.md precedent: a helper defined in
// one route.ts and needed by a sibling route.ts file is invisible to that sibling
// unless explicitly shared (Next.js compiles each route.ts independently). The
// authoritative point value for a scoring event is a fixed fact of its type, never
// something either the client or a JS-computed value should determine (BUG-131).
export const SCORING_POINT_VALUES: Record<string, number> = {
    GOAL: 1,
    PENALTY: 1,
    OWN_GOAL: 1,
    FIELD_GOAL: 2,
    THREE_POINTER: 3,
    FREE_THROW: 1,
};
