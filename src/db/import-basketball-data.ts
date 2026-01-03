/**
 * Basketball Data Import Script
 * 
 * This script imports basketball teams, players, and roster data into the database.
 * 
 * Usage:
 * 1. Prepare your data in JSON format (see examples below)
 * 2. Run: npx tsx src/db/import-basketball-data.ts
 */

import { db } from './index';
import { teams, players } from './schema';
import { nanoid } from 'nanoid';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface BasketballTeamData {
    name: string;
    shortName: string;
    logo?: string;
    university: string;
    color?: string;
    players?: BasketballPlayerData[];
}

interface BasketballPlayerData {
    name: string;
    number: number;
    position: string; // 'PG' | 'SG' | 'SF' | 'PF' | 'C'
    age?: number;
    height?: string; // e.g., "6'2\"" or "188cm"
    weight?: string; // e.g., "180lbs" or "82kg"
    nationality?: string;
    image?: string;
    // Basketball-specific attributes
    attributes?: {
        speed?: number;      // 1-100
        shooting?: number;   // 1-100
        passing?: number;    // 1-100
        dribbling?: number;  // 1-100
        defense?: number;    // 1-100
        physical?: number;   // 1-100
    };
}

// ============================================
// EXAMPLE DATA FORMAT
// ============================================

const EXAMPLE_BASKETBALL_DATA: BasketballTeamData[] = [
    {
        name: "Bells University Eagles",
        shortName: "BU Eagles",
        logo: "/teams/bells-eagles.png",
        university: "Bells University",
        color: "#FF6B35",
        players: [
            {
                name: "John Doe",
                number: 23,
                position: "PG",
                age: 21,
                height: "6'1\"",
                weight: "175lbs",
                nationality: "Nigerian",
                attributes: {
                    speed: 85,
                    shooting: 78,
                    passing: 82,
                    dribbling: 88,
                    defense: 75,
                    physical: 72
                }
            },
            {
                name: "Michael Smith",
                number: 10,
                position: "SG",
                age: 22,
                height: "6'3\"",
                weight: "185lbs",
                nationality: "Nigerian",
                attributes: {
                    speed: 80,
                    shooting: 90,
                    passing: 70,
                    dribbling: 75,
                    defense: 78,
                    physical: 76
                }
            },
            // Add more players...
        ]
    },
    // Add more teams...
];

// ============================================
// IMPORT FUNCTIONS
// ============================================

/**
 * Import a single basketball team and its players
 */
async function importBasketballTeam(teamData: BasketballTeamData) {
    try {
        console.log(`\n📥 Importing team: ${teamData.name}...`);

        // Generate team ID
        const teamId = nanoid();

        // Insert team
        await db.insert(teams).values({
            id: teamId,
            name: teamData.name,
            shortName: teamData.shortName,
            logo: teamData.logo || `/teams/default-basketball.png`,
            university: teamData.university,
            color: teamData.color || '#FF6B35',
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
        });

        console.log(`✅ Team created: ${teamData.name} (ID: ${teamId})`);

        // Import players if provided
        if (teamData.players && teamData.players.length > 0) {
            console.log(`   📋 Importing ${teamData.players.length} players...`);

            for (const playerData of teamData.players) {
                await importBasketballPlayer(playerData, teamId);
            }

            console.log(`   ✅ All players imported for ${teamData.name}`);
        }

        return teamId;
    } catch (error) {
        console.error(`❌ Error importing team ${teamData.name}:`, error);
        throw error;
    }
}

/**
 * Import a single basketball player
 */
async function importBasketballPlayer(playerData: BasketballPlayerData, teamId: string) {
    try {
        const playerId = nanoid();

        // Calculate average rating from attributes
        let rating = 7.0;
        if (playerData.attributes) {
            const attrs = playerData.attributes;
            const total = (attrs.speed || 0) + (attrs.shooting || 0) + (attrs.passing || 0) +
                (attrs.dribbling || 0) + (attrs.defense || 0) + (attrs.physical || 0);
            const count = Object.values(attrs).filter(v => v !== undefined).length;
            rating = count > 0 ? (total / count / 10) : 7.0; // Convert 0-100 to 0-10 scale
        }

        await db.insert(players).values({
            id: playerId,
            name: playerData.name,
            number: playerData.number,
            teamId: teamId,
            position: playerData.position,
            rating: rating,
            eyePoints: 0,
            age: playerData.age,
            height: playerData.height,
            weight: playerData.weight,
            nationality: playerData.nationality || 'Nigerian',
            image: playerData.image,
            attributes: playerData.attributes ? JSON.stringify(playerData.attributes) : null,
        });

        console.log(`      ✓ ${playerData.name} (#${playerData.number}) - ${playerData.position}`);

        return playerId;
    } catch (error) {
        console.error(`      ✗ Error importing player ${playerData.name}:`, error);
        throw error;
    }
}

/**
 * Import all basketball data
 */
async function importAllBasketballData(teamsData: BasketballTeamData[]) {
    console.log('🏀 BASKETBALL DATA IMPORT STARTED');
    console.log('='.repeat(50));
    console.log(`Total teams to import: ${teamsData.length}\n`);

    const importedTeamIds: string[] = [];

    for (const teamData of teamsData) {
        try {
            const teamId = await importBasketballTeam(teamData);
            importedTeamIds.push(teamId);
        } catch (error) {
            console.error(`Failed to import team: ${teamData.name}`);
            // Continue with next team
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ BASKETBALL DATA IMPORT COMPLETED');
    console.log(`Successfully imported ${importedTeamIds.length} teams`);

    return importedTeamIds;
}

// ============================================
// IMPORT FROM JSON FILE
// ============================================

/**
 * Import basketball data from a JSON file
 */
async function importFromJSONFile(filePath: string) {
    try {
        console.log(`📂 Reading data from: ${filePath}`);

        // Dynamic import for Node.js
        const fs = await import('fs');
        const path = await import('path');

        const fullPath = path.resolve(filePath);
        const fileContent = fs.readFileSync(fullPath, 'utf-8');
        const data: BasketballTeamData[] = JSON.parse(fileContent);

        console.log(`✅ Loaded ${data.length} teams from file\n`);

        await importAllBasketballData(data);
    } catch (error) {
        console.error('❌ Error reading JSON file:', error);
        throw error;
    }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    try {
        // Check if a file path was provided as argument
        const args = process.argv.slice(2);

        if (args.length > 0) {
            // Import from provided JSON file
            await importFromJSONFile(args[0]);
        } else {
            // Use example data (for testing)
            console.log('⚠️  No JSON file provided. Using example data...\n');
            console.log('💡 To import from a file, run:');
            console.log('   npx tsx src/db/import-basketball-data.ts path/to/your/data.json\n');

            await importAllBasketballData(EXAMPLE_BASKETBALL_DATA);
        }

        console.log('\n🎉 Import process completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Import process failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

// Export functions for use in other scripts
export {
    importBasketballTeam,
    importBasketballPlayer,
    importAllBasketballData,
    importFromJSONFile,
    type BasketballTeamData,
    type BasketballPlayerData,
};
