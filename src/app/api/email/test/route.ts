import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailConnection, sendEmail } from '@/lib/email';

/**
 * GET /api/email/test - Verify email connection
 * Tests the Gmail transporter configuration
 */
export async function GET(request: NextRequest) {
    try {
        const isConnected = await verifyEmailConnection();

        if (!isConnected) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Email connection failed. Please check your EMAIL_USER and EMAIL_PASS environment variables.',
                    configured: {
                        emailUser: !!process.env.EMAIL_USER,
                        emailPass: !!process.env.EMAIL_PASS,
                    },
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Email service is configured correctly and ready to send emails.',
            configured: {
                emailUser: process.env.EMAIL_USER || 'Not set',
                emailPass: process.env.EMAIL_PASS ? 'Set (hidden)' : 'Not set',
            },
        });
    } catch (error) {
        console.error('[Email Test] Error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to verify email connection',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/email/test - Send a test email
 * Sends a test email to verify the email service is working
 * 
 * Body: { to: string, subject?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, subject } = body;

        if (!to) {
            return NextResponse.json(
                { error: 'Email address (to) is required' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return NextResponse.json(
                { error: 'Invalid email address format' },
                { status: 400 }
            );
        }

        const testSubject = subject || 'Test Email from Brixsport';
        const testHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Test Email</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="background-color: #050505; border: 1px solid #1a1a1a; border-radius: 12px; padding: 40px; color: #ffffff;">
                        <div style="text-align: center; margin-bottom: 32px;">
                            <h1 style="color: #8b5cf6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">BRIXSPORT</h1>
                        </div>
                        
                        <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #ffffff;">Test Email</h2>
                        
                        <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                            This is a test email from your Brixsport application. If you received this email, your email service is configured correctly!
                        </p>
                        
                        <div style="background-color: #1a1a1a; border-radius: 8px; padding: 16px; margin: 24px 0;">
                            <p style="color: #71717a; font-size: 12px; margin: 0; font-family: monospace;">
                                Sent at: ${new Date().toLocaleString()}
                            </p>
                        </div>
                        
                        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1a1a1a;">
                            <p style="color: #52525b; font-size: 12px; margin: 0; text-align: center;">
                                This is an automated test message. Please do not reply to this email.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const result = await sendEmail({
            to,
            subject: testSubject,
            html: testHtml,
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Failed to send test email',
                    error: result.error,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: result.messageId,
            to,
        });
    } catch (error) {
        console.error('[Email Test] Error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'Failed to send test email',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
