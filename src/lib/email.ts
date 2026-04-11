import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// AWS SES imports
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

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

// AWS SES client (initialized only if credentials are available)
let sesClient: SESClient | null = null;

function getSESClient(): SESClient | null {
    if (sesClient) return sesClient;
    
    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    if (!accessKeyId || !secretAccessKey) {
        return null;
    }
    
    sesClient = new SESClient({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
    
    return sesClient;
}

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

// Send email via AWS SES
async function sendViaSES(config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const client = getSESClient();
        if (!client) {
            return { success: false, error: 'AWS SES not configured' };
        }
        
        const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'brixsports2025@gmail.com';
        const fromName = process.env.AWS_SES_FROM_NAME || 'Brixsports';
        
        const command = new SendEmailCommand({
            Source: `${fromName} <${fromEmail}>`,
            Destination: {
                ToAddresses: Array.isArray(config.to) ? config.to : [config.to],
                CcAddresses: config.cc ? (Array.isArray(config.cc) ? config.cc : [config.cc]) : undefined,
                BccAddresses: config.bcc ? (Array.isArray(config.bcc) ? config.bcc : [config.bcc]) : undefined,
            },
            Message: {
                Subject: {
                    Data: config.subject,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: config.html ? {
                        Data: config.html,
                        Charset: 'UTF-8',
                    } : undefined,
                    Text: config.text ? {
                        Data: config.text,
                        Charset: 'UTF-8',
                    } : undefined,
                },
            },
            ReplyToAddresses: config.replyTo ? [config.replyTo] : undefined,
        });
        
        const response = await client.send(command);
        
        return {
            success: true,
            messageId: response.MessageId,
        };
    } catch (error) {
        console.error('[Email] SES send failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown SES error',
        };
    }
}

// Determine which email provider to use
function getEmailProvider(): 'gmail' | 'ses' | 'none' {
    // Check for AWS SES credentials
    const hasSES = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    if (hasSES) return 'ses';
    
    // Check for Gmail credentials
    const hasGmail = process.env.EMAIL_PASS;
    if (hasGmail) return 'gmail';
    
    return 'none';
}

// General email sending function
export async function sendEmail(config: EmailConfig): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const provider = getEmailProvider();
    
    // Try to send via available provider
    if (provider === 'ses') {
        const sesResult = await sendViaSES(config);
        if (sesResult.success) return sesResult;
        console.log('[Email] SES failed, falling back to Gmail');
    }
    
    // Fall back to Gmail (or use if SES not configured)
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
export async function sendWelcomeEmail(to: string, userName: string, baseUrl?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://brixsports.com';
    const logoUrl = `${appUrl}/assests/Logos/BRIX-SPORT-LOGO.png`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Brixsport</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #050505;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #0a0a0a 0%, #111111 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 16px; padding: 40px; color: #ffffff;">
                    <!-- Logo -->
                    <div style="text-align: center; margin-bottom: 32px;">
                        <img src="${logoUrl}" alt="Brixsport" style="height: 80px; width: auto;" />
                    </div>

                    <!-- Welcome Header -->
                    <h2 style="font-size: 32px; font-weight: 700; margin-bottom: 8px; color: #ffffff; text-align: center; font-family: 'Bebas Neue', sans-serif; letter-spacing: 2px; text-transform: uppercase;">Welcome to the Game</h2>
                    <p style="color: #3b82f6; font-size: 18px; text-align: center; margin-bottom: 32px; font-weight: 600;">Hey ${userName}, your sports journey starts now!</p>

                    <!-- What is Brixsports -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">What is Brixsports?</h3>
                        <p style="color: #a1a1aa; line-height: 1.8; margin-bottom: 16px; font-size: 15px;">
                            Brixsports is your ultimate sports platform for <strong style="color: #ffffff;">university competitions</strong>. We bring together athletes, teams, and fans in one powerful ecosystem designed for the love of the game.
                        </p>
                    </div>

                    <!-- Features Grid -->
                    <div style="margin-bottom: 32px;">
                        <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 24px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">What You Can Do</h3>

                        <!-- Feature 1 -->
                        <div style="display: flex; align-items: flex-start; margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
                                <span style="color: #ffffff; font-size: 20px;">🏆</span>
                            </div>
                            <div>
                                <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">Track Live Competitions</h4>
                                <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Follow BUSA, NESA, NPUGA and other tournaments with real-time scores and standings.</p>
                            </div>
                        </div>

                        <!-- Feature 2 -->
                        <div style="display: flex; align-items: flex-start; margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
                                <span style="color: #ffffff; font-size: 20px;">📊</span>
                            </div>
                            <div>
                                <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">Player Stats & Analytics</h4>
                                <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Track performance metrics, ratings, and achievements for every player and team.</p>
                            </div>
                        </div>

                        <!-- Feature 3 -->
                        <div style="display: flex; align-items: flex-start; margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
                                <span style="color: #ffffff; font-size: 20px;">⚽</span>
                            </div>
                            <div>
                                <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">Multiple Sports</h4>
                                <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Football, Basketball, Scrabble, Chess, Table Tennis - we've got them all covered.</p>
                            </div>
                        </div>

                        <!-- Feature 4 -->
                        <div style="display: flex; align-items: flex-start; margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
                                <span style="color: #ffffff; font-size: 20px;">🎯</span>
                            </div>
                            <div>
                                <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">Make Predictions</h4>
                                <p style="color: #a1a1aa; font-size: 14px; margin: 0;">Predict match outcomes, earn points, and compete on the prediction leaderboard.</p>
                            </div>
                        </div>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${appUrl}/competitions"
                           style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 18px 48px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);">
                            Explore Competitions
                        </a>
                    </div>

                    <!-- Footer -->
                    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #1f2937;">
                        <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px; text-align: center;">
                            Need help? Contact us at support@brixsports.com
                        </p>
                        <p style="color: #4b5563; font-size: 12px; margin: 0; text-align: center;">
                            © 2025 Brixsports. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const text = `
Welcome to Brixsports, ${userName}!

Hey ${userName}, your sports journey starts now!

What is Brixsports?
Brixsports is your ultimate sports platform for university competitions. We bring together athletes, teams, and fans in one powerful ecosystem designed for the love of the game.

What You Can Do:
🏆 Track Live Competitions - Follow BUSA, NESA, NPUGA and other tournaments with real-time scores and standings.
📊 Player Stats & Analytics - Track performance metrics, ratings, and achievements for every player and team.
⚽ Multiple Sports - Football, Basketball, Scrabble, Chess, Table Tennis - we've got them all covered.
🎯 Make Predictions - Predict match outcomes, earn points, and compete on the prediction leaderboard.

Get Started: ${appUrl}/competitions

Need help? Contact us at support@brixsports.com
© 2025 Brixsports. All rights reserved.
    `;

    return await sendEmail({
        to,
        subject: 'Welcome to Brixsports - Your Sports Journey Starts Now!',
        html,
        text,
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
