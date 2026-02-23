import nodemailer from 'nodemailer';

// Configure the transporter for Gmail
// Note: For Gmail, you must use an "App Password" (not your regular password)
// Go to Google Account -> Security -> 2-Step Verification -> App Passwords
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'brixsports2025@gmail.com',
        pass: process.env.EMAIL_PASS, // This should be the 16-character App Password
    },
});

export async function sendPasswordResetEmail(to: string, resetLink: string) {
    const mailOptions = {
        from: `"Brixsport Security" <${process.env.EMAIL_USER || 'brixsports2025@gmail.com'}>`,
        to,
        subject: 'Reset Your Brixsport Password',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #1a1a1a; background-color: #050505; color: #ffffff; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">BRIXSPORT</h1>
                </div>
                <h2 style="font-size: 20px; margin-bottom: 16px;">Password Reset Request</h2>
                <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
                    We received a request to reset your password for your Brixsport account. 
                    If you didn't make this request, you can safely ignore this email.
                </p>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="${resetLink}" style="background-color: #8b5cf6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #71717a; font-size: 14px; margin-bottom: 8px;">
                    This link will expire in 1 hour.
                </p>
                <p style="color: #71717a; font-size: 12px; margin: 0; border-top: 1px solid #1a1a1a; padding-top: 16px;">
                    If the button above doesn't work, copy and paste this link into your browser:
                    <br/>
                    <span style="color: #8b5cf6; word-break: break-all;">${resetLink}</span>
                </p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[Email] Reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[Email] Failed to send email:', error);
        // Fallback for development: show the link in the terminal
        if (process.env.NODE_ENV === 'development') {
            console.log('\n--- DEVELOPMENT RESET LINK ---');
            console.log(`To: ${to}`);
            console.log(`Link: ${resetLink}`);
            console.log('------------------------------\n');
        }
        throw error;
    }
}
