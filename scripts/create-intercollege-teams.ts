import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '../src/db';
import { teams } from '../src/db/schema';
import { nanoid } from 'nanoid';

const intercollege_teams = [
  {
    id: nanoid(),
    name: 'College of Natural & Applied Sciences',
    shortName: 'CNAS',
    sport: 'Football',
    university: 'Bells University of Technology',
    color: '#16a34a',
    logo: '/assets/Logos/placeholder.png',
    gender: 'male',
  },
  {
    id: nanoid(),
    name: 'College of Engineering',
    shortName: 'CENG',
    sport: 'Football',
    university: 'Bells University of Technology',
    color: '#2563eb',
    logo: '/assets/Logos/placeholder.png',
    gender: 'male',
  },
  {
    id: nanoid(),
    name: 'College of Management Sciences',
    shortName: 'CMANS',
    sport: 'Football',
    university: 'Bells University of Technology',
    color: '#9333ea',
    logo: '/assets/Logos/placeholder.png',
    gender: 'male',
  },
  {
    id: nanoid(),
    name: 'College of Environmental Sciences',
    shortName: 'CENVS',
    sport: 'Football',
    university: 'Bells University of Technology',
    color: '#ea580c',
    logo: '/assets/Logos/placeholder.png',
    gender: 'male',
  },
];

async function run() {
  console.log('Creating Intercollege teams...');
  for (const team of intercollege_teams) {
    await db.insert(teams).values(team);
    console.log(`✅ Created: ${team.name} (${team.shortName})`);
  }
  console.log('Done.');
}

run().catch(console.error);
