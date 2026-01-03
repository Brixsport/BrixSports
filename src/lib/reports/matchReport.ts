/**
 * PDF Match Report Generator
 * Auto-generate professional PDF summaries of matches
 */

'use client';

interface MatchReportData {
    match: {
        id: string;
        homeTeam: { name: string; logo: string };
        awayTeam: { name: string; logo: string };
        homeScore: number;
        awayScore: number;
        startTime: string;
        venue: string;
        competition: string;
        sport: string;
    };
    events: Array<{
        id: string;
        type: string;
        minute: number;
        second?: number;
        teamId: string;
        playerId?: string;
        detail?: string;
        loggerName?: string;
    }>;
    stats?: {
        homeTeam: Record<string, number>;
        awayTeam: Record<string, number>;
    };
}

/**
 * Generate HTML for PDF report
 * Using HTML allows easy conversion to PDF via browser print or libraries
 */
export function generateMatchReportHTML(data: MatchReportData): string {
    const { match, events, stats } = data;

    // Calculate statistics
    const homeEvents = events.filter(e => e.teamId === match.homeTeam.name);
    const awayEvents = events.filter(e => e.teamId === match.awayTeam.name);

    const homeGoals = homeEvents.filter(e => e.type === 'Goal' || e.type === 'Field Goal' || e.type === 'Three Pointer').length;
    const awayGoals = awayEvents.filter(e => e.type === 'Goal' || e.type === 'Field Goal' || e.type === 'Three Pointer').length;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Match Report - ${match.homeTeam.name} vs ${match.awayTeam.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            padding: 40px;
            background: white;
            color: #1a1a1a;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
        }
        .logo { font-size: 32px; font-weight: bold; color: #3b82f6; }
        .match-title { font-size: 28px; font-weight: bold; margin: 20px 0; }
        .match-info { font-size: 14px; color: #666; margin: 5px 0; }
        
        .score-section {
            display: flex;
            justify-content: space-around;
            align-items: center;
            margin: 40px 0;
            padding: 30px;
            background: #f8fafc;
            border-radius: 12px;
        }
        .team { text-align: center; flex: 1; }
        .team-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .team-score { font-size: 64px; font-weight: bold; color: #3b82f6; }
        .vs { font-size: 32px; font-weight: bold; color: #94a3b8; }
        
        .section {
            margin: 30px 0;
        }
        .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1e293b;
            border-left: 4px solid #3b82f6;
            padding-left: 12px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th {
            background: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:hover { background: #f8fafc; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }
        .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
        .stat-value { font-size: 32px; font-weight: bold; color: #1e293b; margin-top: 5px; }
        
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 12px;
        }
        
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">⚽ BRIX SPORTS</div>
        <div class="match-title">OFFICIAL MATCH REPORT</div>
        <div class="match-info">${match.competition}</div>
        <div class="match-info">${new Date(match.startTime).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })}</div>
        <div class="match-info">${match.venue}</div>
    </div>

    <div class="score-section">
        <div class="team">
            <div class="team-name">${match.homeTeam.name}</div>
            <div class="team-score">${match.homeScore}</div>
        </div>
        <div class="vs">VS</div>
        <div class="team">
            <div class="team-name">${match.awayTeam.name}</div>
            <div class="team-score">${match.awayScore}</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Match Statistics</div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Events</div>
                <div class="stat-value">${events.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">${match.sport === 'Football' ? 'Goals' : 'Scoring Plays'}</div>
                <div class="stat-value">${homeGoals + awayGoals}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">${match.homeTeam.name} Events</div>
                <div class="stat-value">${homeEvents.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">${match.awayTeam.name} Events</div>
                <div class="stat-value">${awayEvents.length}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Match Events Timeline</div>
        <table>
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Player/Details</th>
                    <th>Team</th>
                </tr>
            </thead>
            <tbody>
                ${events.map(event => `
                    <tr>
                        <td><strong>${event.minute}'${event.second ? `:${event.second}` : ''}</strong></td>
                        <td>${event.type}</td>
                        <td>${event.detail || '-'}</td>
                        <td>${event.teamId === match.homeTeam.name ? match.homeTeam.name : match.awayTeam.name}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    ${stats ? `
    <div class="section">
        <div class="section-title">Detailed Statistics</div>
        <table>
            <thead>
                <tr>
                    <th>Statistic</th>
                    <th>${match.homeTeam.name}</th>
                    <th>${match.awayTeam.name}</th>
                </tr>
            </thead>
            <tbody>
                ${Object.keys(stats.homeTeam).map(key => `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${stats.homeTeam[key]}</td>
                        <td>${stats.awayTeam[key]}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by Brix Sports Platform on ${new Date().toLocaleString()}</p>
        <p>Match ID: ${match.id}</p>
        <p>This is an official match report. All data has been verified by certified loggers.</p>
    </div>
</body>
</html>
    `;
}

/**
 * Download match report as PDF
 */
export async function downloadMatchReport(matchId: string) {
    try {
        // Fetch match data
        const matchResponse = await fetch(`/api/matches/${matchId}`);
        const match = await matchResponse.json();

        const eventsResponse = await fetch(`/api/matches/${matchId}/events`);
        const eventsData = await eventsResponse.json();

        // Generate HTML
        const html = generateMatchReportHTML({
            match,
            events: eventsData.events || [],
        });

        // Create a new window and print
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();

            // Wait for content to load then print
            printWindow.onload = () => {
                printWindow.print();
            };
        }
    } catch (error) {
        console.error('Error generating match report:', error);
        alert('Failed to generate match report');
    }
}

/**
 * Generate and download as actual PDF file (requires jsPDF)
 * This is a placeholder - install jsPDF for full implementation
 */
export async function generatePDFReport(matchId: string) {
    // For now, use browser print
    // To implement with jsPDF:
    // 1. npm install jspdf jspdf-autotable
    // 2. Import and use jsPDF library
    // 3. Generate PDF programmatically

    await downloadMatchReport(matchId);
}
