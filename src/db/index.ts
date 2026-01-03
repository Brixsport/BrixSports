import * as dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create client - use local SQLite if Turso credentials not available
const client = createClient({
    url: process.env.TURSO_CONNECTION_URL || 'file:./local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle instance
export const db = drizzle(client, { schema });

export type Database = typeof db;
