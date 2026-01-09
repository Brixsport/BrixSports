import { db } from '../src/db';
import { users } from '../src/db/schema';

async function listUsers() {
    try {
        const allUsers = await db.select().from(users).all();

        if (allUsers.length === 0) {
            console.log('❌ No users found in the database');
            process.exit(0);
        }

        console.log(`\n📋 Found ${allUsers.length} user(s):\n`);
        console.log('─'.repeat(80));

        allUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. User ID: ${user.id}`);
            console.log(`   Name: ${user.name || 'N/A'}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role || 'user'}`);
            console.log(`   Created: ${user.createdAt || 'N/A'}`);
            console.log('─'.repeat(80));
        });

        console.log(`\n💡 To set a user as admin, run:`);
        console.log(`   npm run set-admin <email>\n`);
    } catch (error) {
        console.error('❌ Error listing users:', error);
        process.exit(1);
    }
}

listUsers();
