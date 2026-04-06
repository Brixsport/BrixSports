import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@brixsport.com';

export async function GET() {
    try {
        const config: any = {
            hasPublicKey: !!vapidPublicKey,
            hasPrivateKey: !!vapidPrivateKey,
            publicKeyLength: vapidPublicKey?.length,
            privateKeyLength: vapidPrivateKey?.length,
            publicKey: vapidPublicKey?.substring(0, 20) + '...',
            privateKey: vapidPrivateKey?.substring(0, 20) + '...',
            subject: vapidSubject,
        };

        if (vapidPublicKey && vapidPrivateKey) {
            webpush.setVapidDetails(
                vapidSubject,
                vapidPublicKey,
                vapidPrivateKey
            );
            
            // Test VAPID configuration
            const testPayload = JSON.stringify({
                title: 'Test Notification',
                body: 'VAPID configuration test',
                icon: '/icons/icon-192x192.png',
            });

            // This will throw if VAPID is misconfigured
            try {
                // Just test VAPID setup - try to set it again to validate
                webpush.setVapidDetails(
                    vapidSubject,
                    vapidPublicKey,
                    vapidPrivateKey
                );
                
                // If we get here, VAPID is configured correctly
                config.vapidWorking = true;
                config.vapidInfo = 'VAPID configuration validated successfully';
            } catch (error: any) {
                config.vapidWorking = false;
                config.vapidError = error.message;
            }
        }

        return NextResponse.json({
            success: true,
            config,
            message: config.vapidWorking 
                ? 'VAPID keys are properly configured' 
                : 'VAPID keys are missing or misconfigured'
        });
    } catch (error) {
        console.error('[Notifications Test] Error:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
