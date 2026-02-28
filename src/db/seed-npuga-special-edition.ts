import { db } from './index';
import { competitions, competitionSportSettings, competitionTeamEntries, teams } from './schema';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';

// ─────────────────────────────────────────────
// NPUGA SPECIAL EDITION — COMPETITION SEED SCRIPT
// ─────────────────────────────────────────────

const COMPETITION_ID = nanoid();

// ─────────────────────────────────────────────
// STEP 1: Create the Competition
// ─────────────────────────────────────────────

async function createCompetition() {
    await db.insert(competitions).values({
        id: COMPETITION_ID,
        name: 'NPUGA Special Edition',
        isMultiSport: true,
        format: 'group_knockout', // Football uses group_knockout; others use knockout
        season: '2025',
        level: 'inter-university',
        scope: 'external',
        hostOrganization: 'Bells University of Technology',
        gender: 'mixed', // Both male and female categories
        status: 'upcoming',
        groupDrawComplete: false, // Football draw has not been done yet
        description: 'NPUGA Special Edition — a multi-sport inter-university competition with special formats. Football is 5-aside, Basketball is 3x3, and all match durations are halved.',
        isFeatured: true,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    console.log('✅ Competition created:', COMPETITION_ID);
}

// ─────────────────────────────────────────────
// STEP 2: Create Sport Settings per Sport
// ─────────────────────────────────────────────

async function createSportSettings() {
    const sportSettings = [
        {
            id: nanoid(),
            competitionId: COMPETITION_ID,
            sport: 'Football',
            format: '5-aside',
            playersPerSide: 5,
            halfDuration: 20,    // Halved from standard 45 mins
            matchDuration: 40,   // Total halved match
            isTimed: true,
            customRules: JSON.stringify({
                format: '5-aside',
                substituteLimit: 3,
                note: 'Standard football rules apply but halved durations and 5 players per side',
            }),
        },
        {
            id: nanoid(),
            competitionId: COMPETITION_ID,
            sport: 'Basketball',
            format: '3x3',
            playersPerSide: 3,
            halfDuration: 10,    // Halved
            matchDuration: 20,   // Total halved
            isTimed: true,
            customRules: JSON.stringify({
                format: '3x3',
                note: 'Standard 3x3 basketball rules apply with halved durations',
            }),
        },
        {
            id: nanoid(),
            competitionId: COMPETITION_ID,
            sport: 'Scrabble',
            format: '1v1',
            playersPerSide: 1,
            halfDuration: null,   // Not time-based
            matchDuration: null,  // Not time-based
            isTimed: false,
            customRules: JSON.stringify({
                format: 'round-based',
                tracking: 'score-per-game',
                rounds: 3,
                note: 'Players compete in round-based games. Scores tracked per game.',
            }),
        },
        {
            id: nanoid(),
            competitionId: COMPETITION_ID,
            sport: 'Chess',
            format: '1v1',
            playersPerSide: 1,
            halfDuration: null,
            matchDuration: null,
            isTimed: false,
            customRules: JSON.stringify({
                format: 'round-based',
                tracking: 'wins-per-round',
                rounds: 5,
                note: 'Players compete in rounds. Wins tracked per round.',
            }),
        },
        {
            id: nanoid(),
            competitionId: COMPETITION_ID,
            sport: 'Table Tennis',
            format: 'singles',    // Singles default; doubles also allowed
            playersPerSide: 1,
            halfDuration: null,
            matchDuration: null,
            isTimed: false,
            customRules: JSON.stringify({
                format: 'set-based',
                bestOf: 5,
                allowDoubles: true,
                doublesPlayersPerSide: 2,
                note: 'Set-based competition. Best of 5 sets. Doubles also available.',
            }),
        },
    ];

    await db.insert(competitionSportSettings).values(sportSettings);
    console.log('✅ Sport settings created for all 5 sports');
}

// ─────────────────────────────────────────────
// STEP 3: Define University Sport Participation
// ─────────────────────────────────────────────
// Based on official NPUGA Special Edition document
// M = Male team, F = Female team

const universityParticipation: {
    university: string;
    sports: { sport: string; genders: string[] }[];
}[] = [
    {
        university: 'Achievers University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
        ],
    },
    {
        university: 'Adeleke University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
        ],
    },
    {
        university: 'Afe Babalola University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Bells University of Technology',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male', 'female'] },
        ],
    },
    {
        university: 'Bowen University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male', 'female'] },
        ],
    },
    {
        university: 'Christopher University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Fountain University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Gregory University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male'] },
            { sport: 'Chess', genders: ['male'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Joseph Ayo Babalola University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Redeemers University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male', 'female'] },
        ],
    },
    {
        university: 'Trinity University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male', 'female'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
    {
        university: 'Venite University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
        ],
    },
    {
        university: 'Veritas University',
        sports: [
            { sport: 'Basketball', genders: ['male'] },
            { sport: 'Football', genders: ['male'] },
            { sport: 'Scrabble', genders: ['male', 'female'] },
            { sport: 'Chess', genders: ['male'] },
            { sport: 'Table Tennis', genders: ['male'] },
        ],
    },
];

// ─────────────────────────────────────────────
// STEP 4: Create Teams & Competition Entries
// ─────────────────────────────────────────────

async function createTeamsAndEntries() {
    for (const uni of universityParticipation) {
        for (const sportEntry of uni.sports) {
            for (const gender of sportEntry.genders) {

                // Check if team already exists (especially for Bells)
                const existingTeam = await db.query.teams.findFirst({
                    where: and(
                        eq(teams.university, uni.university),
                        eq(teams.sport, sportEntry.sport),
                        eq(teams.gender, gender),
                    ),
                });

                let teamId: string;

                if (existingTeam) {
                    // Reuse existing team (important for Bells University)
                    teamId = existingTeam.id;
                    console.log(`♻️  Reusing existing team: ${uni.university} - ${sportEntry.sport} (${gender})`);
                } else {
                    // Create new team
                    teamId = nanoid();
                    const shortUni = uni.university.split(' ')[0]; // e.g. "Bells"
                    const genderLabel = gender === 'male' ? 'M' : 'F';

                    await db.insert(teams).values({
                        id: teamId,
                        name: `${uni.university} ${sportEntry.sport} (${genderLabel})`,
                        shortName: `${shortUni} ${genderLabel}`,
                        logo: '',        // To be uploaded later
                        university: uni.university,
                        color: '#000000',
                        sport: sportEntry.sport,
                        gender: gender,
                        createdAt: new Date(),
                    });

                    console.log(`✅ Team created: ${uni.university} - ${sportEntry.sport} (${gender})`);
                }

                // Register team in competition
                // groupName is null for all football teams — draw not done yet
                await db.insert(competitionTeamEntries).values({
                    id: nanoid(),
                    competitionId: COMPETITION_ID,
                    teamId: teamId,
                    sport: sportEntry.sport,
                    gender: gender,
                    groupName: null, // Will be assigned after the football draw
                    status: 'registered',
                    createdAt: new Date(),
                });

                console.log(`📋 Team entry registered: ${uni.university} - ${sportEntry.sport} (${gender})`);
            }
        }
    }
}

// ─────────────────────────────────────────────
// STEP 5: Run Everything
// ─────────────────────────────────────────────

async function main() {
    try {
        console.log('🚀 Starting NPUGA Special Edition setup...\n');

        await createCompetition();
        await createSportSettings();
        await createTeamsAndEntries();

        console.log('\n🎉 NPUGA Special Edition setup complete!');
        console.log(`Competition ID: ${COMPETITION_ID}`);
        console.log('Note: Football group draw is pending. Run the group assignment script once the draw is done.');
    } catch (error) {
        console.error('❌ Error during setup:', error);
        throw error;
    }
}

main();

// ─────────────────────────────────────────────
// BONUS: Group Assignment Script (run after draw)
// Call this once the football draw is complete
// ─────────────────────────────────────────────

export async function assignFootballGroups(groupAssignments: {
    teamId: string;
    groupName: string; // 'A' | 'B' | 'C' | etc.
}[]) {
    for (const assignment of groupAssignments) {
        await db
            .update(competitionTeamEntries)
            .set({ groupName: assignment.groupName })
            .where(
                and(
                    eq(competitionTeamEntries.teamId, assignment.teamId),
                    eq(competitionTeamEntries.competitionId, COMPETITION_ID),
                    eq(competitionTeamEntries.sport, 'Football'),
                )
            );
        console.log(`✅ Assigned team ${assignment.teamId} to Group ${assignment.groupName}`);
    }

    // Mark draw as complete on the competition
    await db
        .update(competitions)
        .set({ groupDrawComplete: true })
        .where(eq(competitions.id, COMPETITION_ID));

    console.log('🎉 Football group draw complete!');
}
