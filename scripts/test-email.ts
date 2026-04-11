import { sendPasswordResetEmail } from '../src/lib/email';

async function testEmail() {
    const testEmail = process.argv[2] || 'your-test-email@gmail.com';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=test-token-123`;

    console.log(`Testing email send to: ${testEmail}`);

    const result = await sendPasswordResetEmail(testEmail, resetLink, baseUrl);

    if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', result.messageId);
    } else {
        console.log('❌ Email failed to send');
        console.log('Error:', result.error);
    }
}

testEmail();
