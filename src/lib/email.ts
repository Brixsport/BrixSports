import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email configuration interface
interface EmailConfig {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: string | Buffer;
        contentType?: string;
    }>;
}

// Configure the transporter for Gmail
// Note: For Gmail, you must use an "App Password" (not your regular password)
// Go to Google Account -> Security -> 2-Step Verification -> App Passwords
// Or use OAuth2 for more secure authentication
function createTransporter(): Transporter {
    const emailUser = process.env.EMAIL_USER || 'brixsports2025@gmail.com';
    const emailPass = process.env.EMAIL_PASS;

    if (!emailPass) {
        console.warn('[Email] EMAIL_PASS environment variable is not set. Email sending will fail.');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass, // This should be the 16-character App Password
        },
        // Optional: Add connection pool settings
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
    });
}

// Create transporter instance
const transporter = createTransporter();

// Verify transporter connection
export async function verifyEmailConnection(): Promise<boolean> {
    try {
        await transporter.verify();
        console.log('[Email] Server is ready to send messages');
        return true;
    } catch (error) {
        console.error('[Email] Server verification failed:', error);
        return false;
    }
}

// General email sending function
export async function sendEmail(config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const emailUser = process.env.EMAIL_USER || 'brixsports2025@gmail.com';
    const defaultFrom = `"Brixsport" <${emailUser}>`;

    const mailOptions = {
        from: config.from || defaultFrom,
        to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
        subject: config.subject,
        html: config.html,
        text: config.text,
        replyTo: config.replyTo,
        cc: config.cc ? (Array.isArray(config.cc) ? config.cc.join(', ') : config.cc) : undefined,
        bcc: config.bcc ? (Array.isArray(config.bcc) ? config.bcc.join(', ') : config.bcc) : undefined,
        attachments: config.attachments,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[Email] Email sent successfully:', {
            messageId: info.messageId,
            to: config.to,
            subject: config.subject,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Email] Failed to send email:', {
            error: errorMessage,
            to: config.to,
            subject: config.subject,
        });

        // In development, log email details for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log('\n--- DEVELOPMENT EMAIL DEBUG ---');
            console.log('To:', config.to);
            console.log('Subject:', config.subject);
            if (config.html) {
                console.log('HTML Content Length:', config.html.length);
            }
            console.log('Error:', errorMessage);
            console.log('-------------------------------\n');
        }

        return { success: false, error: errorMessage };
    }
}

// Password reset email template
export async function sendPasswordResetEmail(to: string, resetLink: string, baseUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://brixsports.com';
    const logoUrl = `${appUrl}/assests/Logos/BRIX-SPORT-LOGO.png`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #050505;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #0a0a0a 0%, #111111 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 16px; padding: 40px; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <img src="${logoUrl}" alt="Brixsport" style="height: 64px; width: auto;" />
                    </div>

                    <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 16px; color: #ffffff; text-align: center; font-family: 'Bebas Neue', sans-serif; letter-spacing: 1px; text-transform: uppercase;">Password Reset Request</h2>

                    <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; font-size: 16px; text-align: center;">
                        We received a request to reset your password for your Brixsport account.
                        If you didn't make this request, you can safely ignore this email.
                    </p>

                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${resetLink}"
                           style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);">
                            Reset Password
                        </a>
                    </div>

                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px; text-align: center;">
                        This link will expire in 1 hour.
                    </p>

                    <div style="border-top: 1px solid #1f2937; padding-top: 24px; margin-top: 32px;">
                        <p style="color: #6b7280; font-size: 12px; margin-bottom: 8px; text-align: center;">
                            If the button doesn't work, copy and paste this link:
                        </p>
                        <p style="color: #3b82f6; word-break: break-all; font-size: 12px; margin: 0; font-family: monospace; text-align: center;">
                            ${resetLink}
                        </p>
                    </div>

                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1f2937;">
                        <p style="color: #4b5563; font-size: 12px; margin: 0; text-align: center;">
                            This is an automated message. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
BRIXSPORT - Password Reset Request

We received a request to reset your password for your Brixsport account. 
If you didn't make this request, you can safely ignore this email.

Reset your password by clicking the link below:
${resetLink}

This link will expire in 1 hour.

This is an automated message. Please do not reply to this email.
    `;

    return await sendEmail({
        to,
        subject: 'Reset Your Brixsport Password',
        html,
        text,
    });
}

// Welcome email template
export async function sendWelcomeEmail(to: string, userName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Brixsport</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background-color: #050505; border: 1px solid #1a1a1a; border-radius: 12px; padding: 40px; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="color: #8b5cf6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">BRIXSPORT</h1>
                    </div>
                    
                    <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #ffffff;">Welcome to Brixsport, ${userName}!</h2>
                    
                    <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                        Thank you for joining Brixsport! We're excited to have you on board.
                    </p>
                    
                    <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                        Get started by exploring our features and connecting with the community.
                    </p>
                    
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1a1a1a;">
                        <p style="color: #52525b; font-size: 12px; margin: 0; text-align: center;">
                            This is an automated message. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({
        to,
        subject: 'Welcome to Brixsport!',
        html,
    });
}

// Notification email template
export async function sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background-color: #050505; border: 1px solid #1a1a1a; border-radius: 12px; padding: 40px; color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <h1 style="color: #8b5cf6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">BRIXSPORT</h1>
                    </div>
                    
                    <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #ffffff;">${title}</h2>
                    
                    <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                        ${message}
                    </p>
                    
                    ${actionUrl && actionText ? `
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="${actionUrl}" 
                               style="background-color: #8b5cf6; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
                                ${actionText}
                            </a>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1a1a1a;">
                        <p style="color: #52525b; font-size: 12px; margin: 0; text-align: center;">
                            This is an automated message. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({
        to,
        subject: title,
        html,
    });
}
