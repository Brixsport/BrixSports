import * as dotenv from 'dotenv';
import { db } from './index';
import { players } from './schema';

// Load environment variables
dotenv.config();

/**
 * BUSA League Football - Player Roster Import Script
 * Import player rosters for semi-finalist teams
 * 
 * Semi-Finalists:
 * - Joga-Bonito (busa-joga)
 * - Kings FC (busa-kings)
 * - Hammers (busa-hammers)
 * - Pirates FC (busa-pirates)
 */

// Player roster data structure
interface PlayerRoster {
    teamId: string;
    players: {
        name: string;
        jerseyName?: string | null; // Name on jersey for logger identification
        number: number;
        position: string; // 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'
        college?: string | null; // For interdepartmental competitions
        department?: string | null; // For interdepartmental competitions
        age?: number;
        height?: string;
        nationality?: string;
        image?: string;
    }[];
}

// Helper function to map position codes to standard positions
function mapPosition(positions: string): string {
    // Takes first position from semicolon-separated list
    const positionMap: Record<string, string> = {
        'GK': 'GK',
        'CB': 'CB',
        'LB': 'LB',
        'RB': 'RB',
        'DM': 'CDM',
        'CM': 'CM',
        'AM': 'CAM',
        'LW': 'LW',
        'RW': 'RW',
        'CF': 'ST',
    };

    const firstPosition = positions.split(';')[0].trim();
    return positionMap[firstPosition] || 'CM'; // Default to CM if unknown
}

// Actual player roster data
const playerRosters: PlayerRoster[] = [
    // Kings FC Roster
    {
        teamId: 'busa-kings',
        players: [
            {
                name: 'Victor Ememe',
                jerseyName: 'EMEME',
                number: 45,
                position: mapPosition('LW;CM;RB'),
                college: 'COLENG',
                department: 'Mechanical',
                nationality: 'Nigeria',
            },
            {
                name: 'Temidayo Olusesi',
                jerseyName: 'TEmi',
                number: 21,
                position: mapPosition('DM'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Osemudiamen Amromawhe',
                jerseyName: 'Amros',
                number: 25,
                position: mapPosition('LB;CB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Chukwuemeka Uduchukwu',
                jerseyName: 'Chukwuemeka',
                number: 5,
                position: mapPosition('CB'),
                college: 'COLENG',
                department: 'civil engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Ayomiposi Peters',
                jerseyName: 'MARTINS',
                number: 66,
                position: mapPosition('RB'),
                college: 'COLMANS',
                department: 'BUSINESS ADMINISTRATION',
                nationality: 'Nigeria',
            },
            {
                name: 'Samuel Ademoyegun',
                jerseyName: 'Osaro',
                number: 8,
                position: mapPosition('RW;LW'),
                college: 'COLENG',
                department: 'Mechanical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Nasirudeen Alabi',
                jerseyName: 'Nas',
                number: 6,
                position: mapPosition('CB'),
                college: 'COLENG',
                department: 'MECHANICAL',
                nationality: 'Nigeria',
            },
            {
                name: 'Tova Ekpere',
                jerseyName: 'T.O.D',
                number: 1,
                position: mapPosition('GK'),
                college: 'COLENG',
                department: 'Mechatronics engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Daniel Tiamiyu',
                jerseyName: 'Tiamiyu',
                number: 77,
                position: mapPosition('RB'),
                college: 'COLENG',
                department: 'Cilvil Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Reward Akpoterabor',
                jerseyName: 'REWARD',
                number: 4,
                position: mapPosition('LB;RB;CB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Timileyin Teniola',
                jerseyName: 'Teni',
                number: 19,
                position: mapPosition('GK'),
                college: 'COLNAS',
                department: 'biotechnology',
                nationality: 'Nigeria',
            },
            {
                name: 'Innocent Kedem',
                jerseyName: null,
                number: 10,
                position: mapPosition('CF;RW;LW;AM;CM;DM'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Toheeb Akinbode',
                jerseyName: 'AKINBODE',
                number: 17,
                position: mapPosition('DM'),
                college: 'COLENG',
                department: null,
                nationality: 'Nigeria',
            },
        ]
    },
    // Joga-Bonito Roster
    {
        teamId: 'busa-joga',
        players: [
            {
                name: 'Emmanuel Adeyanju',
                jerseyName: 'IDIMU',
                number: 17,
                position: mapPosition('LW'),
                college: 'COLENG',
                department: 'Mechanical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Adetokunbo Adedeji',
                jerseyName: 'BLACKO',
                number: 6,
                position: mapPosition('CM;DM;CB'),
                college: 'COLENVS',
                department: 'ARCHITECTURE',
                nationality: 'Nigeria',
            },
            {
                name: 'Benjamin Adenuga',
                jerseyName: 'CapoBenjas',
                number: 100,
                position: mapPosition('CB'),
                college: 'COLENG',
                department: 'Civil Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'McAnthony Uzowuru',
                jerseyName: 'McTEE',
                number: 2,
                position: mapPosition('CB'),
                college: 'COLENVS',
                department: 'Electrical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'James Olusanya',
                jerseyName: 'FOWOSERE',
                number: 1,
                position: mapPosition('GK'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'David Disu',
                jerseyName: 'ODYSSEY',
                number: 7,
                position: mapPosition('RW;LW'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Samuel Olapite',
                jerseyName: 'SAMMY',
                number: 45,
                position: mapPosition('CF;RW;LW'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Hussein Johnson',
                jerseyName: 'Kenny',
                number: 9,
                position: mapPosition('CF;RW;LW'),
                college: 'COLENG',
                department: 'Biomedical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Justin Onyeka',
                jerseyName: 'Yanko',
                number: 80,
                position: mapPosition('AM;CM'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Burhan Yusuff',
                jerseyName: 'Adebayo',
                number: 19,
                position: mapPosition('CF;LW'),
                college: 'COLENG',
                department: 'Computer Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Uthman Sadiq',
                jerseyName: 'Barella',
                number: 67,
                position: mapPosition('CM;DM;RB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Ayomiposi Alabi',
                jerseyName: 'Puyoo',
                number: 24,
                position: mapPosition('RB'),
                college: 'COLENVS',
                department: 'ARCHITECTURE',
                nationality: 'Nigeria',
            },
            {
                name: 'Emmanuel Ekpenyong',
                jerseyName: 'Koko',
                number: 70,
                position: mapPosition('RB;CB'),
                college: 'COLENG',
                department: 'Biomedical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Japheth Oseiegbu',
                jerseyName: 'JAPHETH',
                number: 13,
                position: mapPosition('GK;CF'),
                college: 'COLNAS',
                department: 'PWS',
                nationality: 'Nigeria',
            },
            {
                name: 'Abdulrahman Ajibola',
                jerseyName: 'HAYJAY',
                number: 8,
                position: mapPosition('CM;DM'),
                college: 'COLENG',
                department: 'Electrical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Goodluck Okeke',
                jerseyName: 'Veronica',
                number: 11,
                position: mapPosition('CM;DM'),
                college: 'COLENG',
                department: 'Mechanical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Damola Akinola',
                jerseyName: 'Aguero',
                number: 10,
                position: mapPosition('AM'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Divine Opyemi',
                jerseyName: 'BRICKS',
                number: 69,
                position: mapPosition('LB;RB'),
                college: 'COLENG',
                department: 'Electrical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Chidumebi Uche',
                jerseyName: 'Uche Jr',
                number: 12,
                position: mapPosition('LB'),
                college: 'COLMANS',
                department: 'Business Admin',
                nationality: 'Nigeria',
            },
            {
                name: 'Triumph Ovieadube',
                jerseyName: '4EKT',
                number: 99,
                position: mapPosition('CM;DM'),
                college: 'COLENG',
                department: 'Mechatronics',
                nationality: 'Nigeria',
            },
            {
                name: 'Sharafadeen Alagbe',
                jerseyName: 'Sharfhii',
                number: 88,
                position: mapPosition('LB;RB;CB'),
                college: 'COLMANS',
                department: 'Business Admin',
                nationality: 'Nigeria',
            },
            {
                name: 'Jesse Uno',
                jerseyName: 'Zico',
                number: 30,
                position: mapPosition('AM;LW;CM'),
                college: 'COLNAS',
                department: 'Chemical Science',
                nationality: 'Nigeria',
            },
        ]
    },
    // Pirates FC Roster
    {
        teamId: 'busa-pirates',
        players: [
            {
                name: 'Taiwo Olaofeoguntunde',
                jerseyName: 'Olatee',
                number: 77,
                position: mapPosition('LW'),
                college: 'COLENG',
                department: 'Electrical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Eniola Adeyanju',
                jerseyName: 'Eniola',
                number: 20,
                position: mapPosition('DM'),
                college: 'COLENG',
                department: 'COMPUTER ENGINEERING',
                nationality: 'Nigeria',
            },
            {
                name: 'Vincent Mark',
                jerseyName: 'Vinchi',
                number: 5,
                position: mapPosition('CB'),
                college: 'COLENG',
                department: 'Mechanical engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Emmanuel Uzodimma',
                jerseyName: 'Uzo',
                number: 13,
                position: mapPosition('DM;LB;RB;CB'),
                college: 'Colmans',
                department: 'HRM',
                nationality: 'Nigeria',
            },
            {
                name: 'Abdul-jabbaar Bello',
                jerseyName: 'J.B',
                number: 9,
                position: mapPosition('CF'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Opeyemi Ajani',
                jerseyName: 'OPLUS',
                number: 7,
                position: mapPosition('LW'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Ilyas Lawal-Okunuga',
                jerseyName: 'Ilyasdelaw',
                number: 29,
                position: mapPosition('RW;LW'),
                college: 'COLENG',
                department: 'COMPUTER ENGINEERING',
                nationality: 'Nigeria',
            },
            {
                name: 'Israel Emmanuel',
                jerseyName: 'Israel',
                number: 17,
                position: mapPosition('RW;AM'),
                college: 'COLENG',
                department: 'Mechatronics',
                nationality: 'Nigeria',
            },
            {
                name: 'Francis Abbey',
                jerseyName: 'Musiala',
                number: 10,
                position: mapPosition('AM'),
                college: 'COLENG',
                department: 'Computer Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Olamidotun Salau',
                jerseyName: 'DOTMAN',
                number: 8,
                position: mapPosition('CM'),
                college: 'COLMANS',
                department: 'BASA',
                nationality: 'Nigeria',
            },
            {
                name: 'Mayowa Agoyi',
                jerseyName: 'Mayor',
                number: 11,
                position: mapPosition('CF;RW;LW'),
                college: 'COLENG',
                department: 'Civil Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Tamuno Jumbo',
                jerseyName: 'Rogers',
                number: 6,
                position: mapPosition('DM'),
                college: 'COLNAS',
                department: 'AMS',
                nationality: 'Nigeria',
            },
            {
                name: 'Muiz Kazeem',
                jerseyName: 'AFOO',
                number: 15,
                position: mapPosition('CF'),
                college: 'COLMANS',
                department: null,
                nationality: 'Nigeria',
            },
            {
                name: 'Tomipe Oshi Bodu',
                jerseyName: null,
                number: 1,
                position: mapPosition('GK'),
                college: null,
                department: null,
                nationality: 'Nigeria',
            },
            {
                name: 'Daniel Ezekwe',
                jerseyName: null,
                number: 2,
                position: mapPosition('CB'),
                college: null,
                department: null,
                nationality: 'Nigeria',
            },
            {
                name: 'Courage Alegbe',
                jerseyName: null,
                number: 4,
                position: mapPosition('RB'),
                college: null,
                department: null,
                nationality: 'Nigeria',
            },
            {
                name: 'Khalid Adeboye',
                jerseyName: null,
                number: 24,
                position: mapPosition('RB'),
                college: null,
                department: null,
                nationality: 'Nigeria',
            },
            {
                name: 'Netochukwu Mba',
                jerseyName: null,
                number: 19,
                position: mapPosition('RB'),
                college: null,
                department: null,
                nationality: 'Nigeria',
            },
        ]
    },
    // Hammers Roster
    {
        teamId: 'busa-hammers',
        players: [
            {
                name: 'Iseoluwa Wusu',
                jerseyName: 'Ise',
                number: 32,
                position: mapPosition('CF;AM'),
                college: 'COLENG',
                department: 'Computer engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Jerry Okpighe',
                jerseyName: 'JXRXY',
                number: 77,
                position: mapPosition('CF;LW;AM'),
                college: 'COLENVS',
                department: 'SGF',
                nationality: 'Nigeria',
            },
            {
                name: 'Ephraim Ogah',
                jerseyName: 'Spectrum',
                number: 10,
                position: mapPosition('CF;RW;LW'),
                college: 'COLENG',
                department: 'MECHATRONICS ENGINEERING',
                nationality: 'Nigeria',
            },
            {
                name: 'David Alexander',
                jerseyName: 'Kadibia',
                number: 19,
                position: mapPosition('CF;LW;CM;LB'),
                college: 'COLENG',
                department: 'Mechatronics Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Tobi Odeyemi',
                jerseyName: 'Stacey',
                number: 66,
                position: mapPosition('LB;RB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Iyanuloluwa Olusore',
                jerseyName: 'YANU',
                number: 5,
                position: mapPosition('LB;RB;CB'),
                college: 'COLENG',
                department: 'Mechatronics engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Joseph Ikyernum',
                jerseyName: 'Sancho',
                number: 8,
                position: mapPosition('RW;AM'),
                college: 'COLENG',
                department: 'Biomedical engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Oluwasurefunmi Adetuyi',
                jerseyName: 'Speedy',
                number: 11,
                position: mapPosition('LW'),
                college: 'COLENG',
                department: 'Computer Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Joseph Adewale',
                jerseyName: 'A.jay',
                number: 41,
                position: mapPosition('DM'),
                college: 'COLENVS',
                department: 'Estate Management',
                nationality: 'Nigeria',
            },
            {
                name: 'Blessed Kingston',
                jerseyName: 'Kingston',
                number: 20,
                position: mapPosition('CF;AM;CM'),
                college: 'COLENG',
                department: 'Electrical electronics',
                nationality: 'Nigeria',
            },
            {
                name: 'Olaoluwa Olusanya',
                jerseyName: 'Woods',
                number: 97,
                position: mapPosition('CM'),
                college: 'COLENG',
                department: 'Mechanical Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Edifon Ubeh',
                jerseyName: 'Eddie',
                number: 15,
                position: mapPosition('RB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
            {
                name: 'Bruno Ken',
                jerseyName: null,
                number: 24,
                position: mapPosition('CM;DM'),
                college: 'COLENG',
                department: 'Computer Engineering',
                nationality: 'Nigeria',
            },
            {
                name: 'Umar Sanusi',
                jerseyName: 'Umvri',
                number: 3,
                position: mapPosition('LB'),
                college: 'COLNAS',
                department: 'CSC/IT',
                nationality: 'Nigeria',
            },
        ]
    },
];

async function importPlayerRosters() {
    console.log('👥 Importing player rosters for semi-finalists...');

    try {
        let totalPlayers = 0;

        for (const roster of playerRosters) {
            console.log(`\n📋 Importing roster for team: ${roster.teamId}`);

            for (const player of roster.players) {
                const playerId = `${roster.teamId}-player-${player.number}`;

                await db.insert(players).values({
                    id: playerId,
                    name: player.name,
                    jerseyName: player.jerseyName,
                    number: player.number,
                    teamId: roster.teamId,
                    position: player.position,
                    college: player.college,
                    department: player.department,
                    age: player.age,
                    height: player.height,
                    nationality: player.nationality || 'Nigeria',
                    image: player.image,
                    rating: 7.0, // Default rating, can be updated later
                    eyePoints: 0, // Will be calculated from match events
                });

                totalPlayers++;
            }

            console.log(`   ✅ ${roster.players.length} players imported for ${roster.teamId}`);
        }

        console.log(`\n✅ Player roster import completed!`);
        console.log(`   - Total players imported: ${totalPlayers}`);
        console.log(`   - Teams with rosters: ${playerRosters.length}`);
    } catch (error) {
        console.error('❌ Error importing player rosters:', error);
        throw error;
    }
}

// Run import if this file is executed directly
if (require.main === module) {
    importPlayerRosters()
        .then(() => {
            console.log('Import completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Import failed:', error);
            process.exit(1);
        });
}

export { importPlayerRosters };
