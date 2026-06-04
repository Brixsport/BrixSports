import * as fs from 'fs';
import * as path from 'path';

async function createTemplate() {
    const headers = [
        'matchDate', 'homeTeamName', 'awayTeamName', 'homeScore', 'awayScore',
        'venue', 'competition', 'competitionId', 'sport', 'matchType',
        'playerName', 'playerTeam', 'jerseyNumber', 'goals', 'assists',
        'shotsOn', 'shotsOff', 'yellowCards', 'redCards', 'tackles',
        'interceptions', 'clearances', 'fouls', 'saves', 'blocks',
        'rating', 'subIn', 'subOut'
    ];

    const row1 = [
        '2025-03-15T00:00:00Z', 'Kings FC', 'Lions FC', '2', '1',
        'Main Pitch', 'BUSA League', '', 'Football', 'competition',
        'John Doe', 'home', '9', '1', '0',
        '3', '1', '0', '0', '2',
        '1', '1', '0', '0', '0',
        '7.5', '', '85'
    ];

    const row2 = [
        '2025-03-15T00:00:00Z', 'Kings FC', 'Lions FC', '2', '1',
        'Main Pitch', 'BUSA League', '', 'Football', 'competition',
        'James Smith', 'away', '7', '0', '1',
        '2', '0', '1', '0', '1',
        '2', '0', '1', '0', '0',
        '6.8', '60', ''
    ];

    const csvContent = [
        headers.join(','),
        row1.join(','),
        row2.join(',')
    ].join('\n') + '\n';

    const dirPath = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, 'backfill-template.csv');
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    console.log(`✅ Created backfill template at ${filePath}`);
}

createTemplate().catch(console.error);
