import { db } from './index';
import { competitions, competitionSportSettings, organizations, players, playerOrganizationAffiliations } from './schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

async function addNESAInterSchoolFestival() {
  try {
    // Create or find Bells University of Technology (Host Venue) first
    let bellsUniversity = await db.select().from(organizations)
      .where(eq(organizations.name, 'Bells University of Technology'))
      .get();

    if (!bellsUniversity) {
      bellsUniversity = await db.insert(organizations).values({
        id: nanoid(),
        name: 'Bells University of Technology',
        slug: 'bells-university',
        type: 'university',
        shortName: 'BELLSTECH',
        displayName: 'Bells University of Technology',
        status: 'active',
        location: 'Ota, Nigeria',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning().get();
    }

    // Create or find College of Management Sciences at Bells University
    let collegeOfManagement = await db.select().from(organizations)
      .where(eq(organizations.name, 'College of Management Sciences'))
      .get();

    if (!collegeOfManagement) {
      collegeOfManagement = await db.insert(organizations).values({
        id: nanoid(),
        name: 'College of Management Sciences',
        slug: 'college-of-management-sciences',
        type: 'college',
        shortName: 'COMS',
        displayName: 'College of Management Sciences',
        parentOrganizationId: bellsUniversity.id,
        isInternalUnit: true,
        status: 'active',
        location: bellsUniversity.location,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning().get();
    }

    // Create NESA (Nigeria Economics Students Association) under College of Management Sciences
    let nesaAssociation = await db.select().from(organizations)
      .where(eq(organizations.name, 'Nigeria Economics Students Association'))
      .get();

    if (!nesaAssociation) {
      nesaAssociation = await db.insert(organizations).values({
        id: nanoid(),
        name: 'Nigeria Economics Students Association',
        slug: 'nesa',
        type: 'association',
        shortName: 'NESA',
        displayName: 'Nigeria Economics Students Association',
        parentOrganizationId: collegeOfManagement.id,
        isInternalUnit: true,
        status: 'active',
        location: bellsUniversity.location,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning().get();
    }

    // Create participating universities
    const participatingUniversities = [
      'Anchor University',
      'Crawford University', 
      'Caleb University',
      'Crescent University',
      'Trinity University',
      'Babcock University'
    ];

    for (const uniName of participatingUniversities) {
      const existing = await db.select().from(organizations)
        .where(eq(organizations.name, uniName))
        .get();
      
      if (!existing) {
        await db.insert(organizations).values({
          id: nanoid(),
          name: uniName,
          slug: uniName.toLowerCase().replace(/\s+/g, '-'),
          type: 'university',
          shortName: uniName.split(' ')[0].toUpperCase(),
          displayName: uniName,
          status: 'active',
          location: 'Nigeria',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Create Economics Departments for each participating university
    const economicsDepartments = [];
    for (const uniName of participatingUniversities) {
      const economicsDeptName = `${uniName} - Economics Department`;
      let economicsDept = await db.select().from(organizations)
        .where(eq(organizations.name, economicsDeptName))
        .get();
      
      if (!economicsDept) {
        // Get the university organization
        const university = await db.select().from(organizations)
          .where(eq(organizations.name, uniName))
          .get();
        
        if (university) {
          economicsDept = await db.insert(organizations).values({
            id: nanoid(),
            name: economicsDeptName,
            slug: `${uniName.toLowerCase().replace(/\s+/g, '-')}-economics`,
            type: 'department',
            shortName: `${uniName.split(' ')[0]} ECON`,
            displayName: economicsDeptName,
            parentOrganizationId: university.id,
            isInternalUnit: true,
            status: 'active',
            location: university.location,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning().get();
          
          economicsDepartments.push(economicsDept);
        }
      } else {
        economicsDepartments.push(economicsDept);
      }
    }

    console.log('✅ Created Economics Departments for NESA eligibility');

    // Example: Function to check if a student is eligible for NESA
    async function checkNESAEligibility(playerId: string) {
      // Check if player has economics department affiliation
      const economicsAffiliation = await db.select()
        .from(playerOrganizationAffiliations)
        .where(eq(playerOrganizationAffiliations.playerId, playerId))
        .get();

      if (economicsAffiliation) {
        // Get the organization details
        const org = await db.select().from(organizations)
          .where(eq(organizations.id, economicsAffiliation.organizationId))
          .get();
        
        // Check if it's an economics department
        return org?.name.includes('Economics Department') || org?.name.includes('Economics');
      }
      
      return false;
    }

    // Example: Function to affiliate a student with NESA Economics
    async function affiliateStudentWithNESA(playerId: string, universityName: string) {
      // Get the economics department for that university
      const economicsDeptName = `${universityName} - Economics Department`;
      const economicsDept = await db.select().from(organizations)
        .where(eq(organizations.name, economicsDeptName))
        .get();
      
      if (economicsDept) {
        // Create affiliation with economics department
        await db.insert(playerOrganizationAffiliations).values({
          id: nanoid(),
          playerId: playerId,
          organizationId: economicsDept.id,
          affiliationType: 'department',
          role: 'economics_student',
          status: 'active',
          isPrimary: false, // University affiliation is primary
          startDate: new Date(),
          createdAt: new Date(),
        });
        
        console.log(`✅ Student ${playerId} affiliated with ${economicsDeptName}`);
        return true;
      }
      
      return false;
    }

    // Create the main NESA Inter-School Sports Festival competition
    const competitionId = nanoid();
    const competition = await db.insert(competitions).values({
      id: competitionId,
      name: 'NESA Inter-School Sports Festival 2026',
      sport: 'Multi-Sport',
      isMultiSport: true,
      format: 'knockout',
      season: '2026',
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-10'), // One-day event
      description: 'One-day Inter-School Sports Festival hosted by Nigeria Economics Students Association (NESA) featuring Male/Female Football, Basketball, Track Events, and Esports competitions',
      level: 'inter-university',
      scope: 'external',
      rules: `NESA Inter-School Sports Festival Rules:
• One-day event with direct knockout format for most competitions
• Male Football: 11-a-side, 15-min halves, 5-min halftime
• Female Football: 5-a-side, 7-min halves, 5-min break
• Basketball: 6-min quarters, 2-min breaks, 4-min halftime
• Track Events: Single final race, one participant per school per event
• FC26: Singles & Doubles, 4-min halves, direct penalties for draws
• Call of Duty Mobile: 2-4 players per team, knockout format
• eFootball Mobile: 2-4 players per team, knockout format
• Points system: Gold/Silver/Bronze medals with cumulative scoring`,
      numberOfTeams: 7, // 7 participating universities
      numberOfGroups: 0, // Knockout format
      teamsPerGroup: 0,
      playersPerSide: 0, // Varies by sport
      gender: 'mixed',
      registrationOpen: true,
      registrationDeadline: new Date('2026-04-05'),
      maxTeams: 7,
      entryFee: '25000', // NGN per university
      hostOrganization: 'Nigeria Economics Students Association',
      hostOrganizationId: nesaAssociation.id,
      governingOrganizationId: bellsUniversity.id, // Bells University as host venue
      status: 'upcoming',
      isFeatured: true,
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning().get();

    console.log('Created NESA Inter-School Sports Festival competition:', competition);

    // Male Football (11-a-side)
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'Football_Male',
      format: 'knockout',
      playersPerSide: 11,
      halfDuration: 15,
      matchDuration: 30,
      customRules: JSON.stringify({
        maxPlayers: 16,
        starters: 11,
        substitutes: 5,
        knockoutFormat: true,
        halftimeBreak: 5,
        drawResolution: 'penalties',
        standardRules: true
      }),
      isTimed: true,
      createdAt: new Date(),
    });

    // Female Football (5-a-side)
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'Football_Female',
      format: 'knockout',
      playersPerSide: 5,
      halfDuration: 7,
      matchDuration: 14,
      customRules: JSON.stringify({
        substitutesAllowed: true,
        knockoutFormat: true,
        breakDuration: 5,
        drawResolution: 'penalties',
        fastPaced: true
      }),
      isTimed: true,
      createdAt: new Date(),
    });

    // Male Basketball
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'Basketball_Male',
      format: 'knockout',
      playersPerSide: 5,
      halfDuration: 6,
      matchDuration: 12,
      customRules: JSON.stringify({
        quarters: 2,
        quarterDuration: 6,
        breakBetweenQuarters: 2,
        halftimeBreak: 4,
        minPlayers: 5,
        maxPlayers: 10,
        tieBreaker: 'free_throws',
        standardRules: true
      }),
      isTimed: true,
      createdAt: new Date(),
    });

    // Track Events
    const trackEvents = ['100m', '200m', '400m'];
    for (const event of trackEvents) {
      await db.insert(competitionSportSettings).values({
        id: nanoid(),
        competitionId: competitionId,
        sport: `Athletics_${event}`,
        format: 'final_race',
        playersPerSide: 1,
        customRules: JSON.stringify({
          eventType: 'track',
          distance: event,
          maxParticipantsPerSchool: 1,
          allowMultipleEvents: true,
          noPreliminaryHeats: true,
          falseStartLimit: 2,
          standardAthleticsRules: true,
          medalsForTop3: true,
          singleFinalRace: true,
          noSubstitutions: true
        }),
        isTimed: false,
        createdAt: new Date(),
      });
    }

    // FC26 Esports - Singles
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'FC26_Singles',
      format: 'knockout',
      playersPerSide: 1,
      customRules: JSON.stringify({
        category: 'singles',
        platform: 'PS5',
        gameSettings: 'standard_fifa',
        halfDuration: 4,
        matchDuration: 8,
        drawResolution: 'penalties',
        noExtraTime: true,
        playersPerSchool: 1,
        knockoutFormat: true
      }),
      isTimed: true,
      createdAt: new Date(),
    });

    // FC26 Esports - Doubles
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'FC26_Doubles',
      format: 'knockout',
      playersPerSide: 2,
      customRules: JSON.stringify({
        category: 'doubles',
        platform: 'PS5',
        gameSettings: 'standard_fifa',
        halfDuration: 4,
        matchDuration: 8,
        drawResolution: 'penalties',
        noExtraTime: true,
        playersPerSchool: 2,
        sameTeamControl: true,
        knockoutFormat: true
      }),
      isTimed: true,
      createdAt: new Date(),
    });

    // Call of Duty Mobile
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'Call_of_Duty_Mobile',
      format: 'knockout',
      playersPerSide: 4,
      customRules: JSON.stringify({
        teamSize: '2-4',
        platform: 'Mobile',
        gameSettings: 'standard_tournament',
        knockoutFormat: true,
        standardTournamentRules: true,
        teamBased: true
      }),
      isTimed: false,
      createdAt: new Date(),
    });

    // eFootball Mobile
    await db.insert(competitionSportSettings).values({
      id: nanoid(),
      competitionId: competitionId,
      sport: 'eFootball_Mobile',
      format: 'knockout',
      playersPerSide: 4,
      customRules: JSON.stringify({
        teamSize: '2-4',
        platform: 'Mobile',
        gameSettings: 'standard',
        knockoutFormat: true,
        drawResolution: 'penalties',
        onePlayerAtATime: true,
        playerRotation: true,
        teamBased: true
      }),
      isTimed: false,
      createdAt: new Date(),
    });

    console.log('✅ NESA Inter-School Sports Festival setup complete!');
    console.log('📋 Competition ID:', competitionId);
    console.log('🏆 Organized by: Nigeria Economics Students Association (NESA)');
    console.log('📍 Hierarchy: Bells University → College of Management Sciences → NESA');
    console.log('📍 Host Venue: Bells University of Technology');
    console.log('🏫 7 Participating Universities:');
    console.log('   • Bells University of Technology (Host Venue)');
    console.log('   • Anchor University');
    console.log('   • Crawford University');
    console.log('   • Caleb University');
    console.log('   • Crescent University');
    console.log('   • Trinity University');
    console.log('   • Babcock University');
    console.log('📚 Economics Departments created for NESA eligibility:');
    economicsDepartments.forEach(dept => {
      console.log(`   • ${dept.name}`);
    });
    console.log('⚽ Male Football: 11v11, 15-min halves, knockout');
    console.log('⚽ Female Football: 5v5, 7-min halves, knockout');
    console.log('🏀 Basketball: 6-min quarters, knockout');
    console.log('🏃 Track Events: 100m, 200m, 400m - single finals');
    console.log('🎮 FC26: Singles & Doubles on PS5');
    console.log('🎯 Call of Duty Mobile: 2-4 players per team');
    console.log('⚽ eFootball Mobile: 2-4 players per team');
    console.log('');
    console.log('🎯 NESA Eligibility System:');
    console.log('   • Students must be affiliated with their university Economics Department');
    console.log('   • NESA members are under College of Management Sciences at Bells University');
    console.log('   • Use affiliateStudentWithNESA() to register economics students');
    console.log('   • Use checkNESAEligibility() to verify player eligibility');
    console.log('');
    console.log('📝 Example usage:');
    console.log('   await affiliateStudentWithNESA("player-id", "Bells University of Technology");');
    console.log('   const isEligible = await checkNESAEligibility("player-id");');

  } catch (error) {
    console.error('❌ Error setting up NESA Inter-School Sports Festival:', error);
    throw error;
  }
}

// Run the setup
addNESAInterSchoolFestival().catch(console.error);
