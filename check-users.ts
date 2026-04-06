import { db } from './src/db';
import { users } from './src/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    const allUsers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        password: users.password
    }).from(users).orderBy(desc(users.createdAt)).limit(10);
    
    console.log(JSON.stringify(allUsers.map(u => ({...u, hasPassword: !!u.password, password: u.password?.substring(0, 10) + '...' })), null, 2));
}

main().catch(console.error);
