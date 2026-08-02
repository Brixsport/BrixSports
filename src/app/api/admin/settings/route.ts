/**
 * Admin Settings API
 * Manages system-wide configuration and algorithm parameters with database persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings, systemSettingsHistory } from '@/db/schema';
import { getAuthUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// Default settings to initialize if not in database
const DEFAULT_SETTINGS = {
    // Algorithm Settings
    'algorithm.eyepoint.weight': { value: '0.5', type: 'number', category: 'algorithm', description: 'Eye Point weighting per award' },
    'algorithm.time.decay': { value: '0.02', type: 'number', category: 'algorithm', description: 'Time decay factor per minute' },
    'algorithm.rating.baseline': { value: '7.0', type: 'number', category: 'algorithm', description: 'Default player rating baseline' },
    'algorithm.rating.max': { value: '10.0', type: 'number', category: 'algorithm', description: 'Maximum player rating' },
    'algorithm.rating.min': { value: '1.0', type: 'number', category: 'algorithm', description: 'Minimum player rating' },

    // System Settings
    'system.maintenance.mode': { value: 'false', type: 'boolean', category: 'system', description: 'Enable maintenance mode' },
    'system.registration.enabled': { value: 'true', type: 'boolean', category: 'system', description: 'Allow new user registrations' },
    'system.notifications.enabled': { value: 'true', type: 'boolean', category: 'system', description: 'Enable push notifications' },

    // Feature Flags
    'features.fpl.enabled': { value: 'true', type: 'boolean', category: 'features', description: 'Enable Fantasy Premier League' },
    'features.predictions.enabled': { value: 'true', type: 'boolean', category: 'features', description: 'Enable match predictions' },
    'features.polls.enabled': { value: 'true', type: 'boolean', category: 'features', description: 'Enable polls' },
    'features.transfers.enabled': { value: 'true', type: 'boolean', category: 'features', description: 'Enable transfer news' },

    // High-Volatility Feature Gates (BACKLOG-155) -- defaulted OFF deliberately.
    // CLAUDE.md's own Live Event Readiness Checklist calls for these gated/hidden
    // before any public match day; defaulting to false means they gate closed
    // automatically rather than depending on someone remembering to flip them.
    'features.ads.enabled': { value: 'false', type: 'boolean', category: 'features', description: 'Enable Ads' },
    'features.lineupbuilder.enabled': { value: 'false', type: 'boolean', category: 'features', description: 'Enable Lineup Builder' },
    'features.usermanagement.enabled': { value: 'false', type: 'boolean', category: 'features', description: 'Enable User Management / Access Control admin panel' },
    'features.news.enabled': { value: 'false', type: 'boolean', category: 'features', description: 'Enable News' },
};

// Initialize default settings in database if they don't exist
async function initializeDefaultSettings() {
    try {
        for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
            const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);

            if (existing.length === 0) {
                await db.insert(systemSettings).values({
                    id: `setting_${key.replace(/\./g, '_')}`,
                    key,
                    value: config.value,
                    type: config.type,
                    category: config.category,
                    description: config.description,
                });
            }
        }
    } catch (error) {
        console.error('Error initializing default settings:', error);
    }
}

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Initialize defaults if needed
        await initializeDefaultSettings();

        // Fetch all settings from database
        const settings = await db.select().from(systemSettings);

        return NextResponse.json({
            settings: settings.map(s => ({
                key: s.key,
                value: s.value,
                type: s.type,
                category: s.category,
                description: s.description,
                updatedAt: s.updatedAt,
            })),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { key, value, reason } = body;

        if (!key || value === undefined) {
            return NextResponse.json(
                { error: 'Missing key or value' },
                { status: 400 }
            );
        }

        // Fetch current setting
        const [currentSetting] = await db
            .select()
            .from(systemSettings)
            .where(eq(systemSettings.key, key))
            .limit(1);

        if (!currentSetting) {
            return NextResponse.json(
                { error: 'Setting not found' },
                { status: 404 }
            );
        }

        // Validate value based on type
        if (currentSetting.type === 'number' && isNaN(Number(value))) {
            return NextResponse.json(
                { error: 'Invalid number value' },
                { status: 400 }
            );
        }

        if (currentSetting.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
            return NextResponse.json(
                { error: 'Invalid boolean value. Must be "true" or "false"' },
                { status: 400 }
            );
        }

        // Create history record
        await db.insert(systemSettingsHistory).values({
            id: `history_${Date.now()}_${key.replace(/\./g, '_')}`,
            settingKey: key,
            oldValue: currentSetting.value,
            newValue: value,
            updatedBy: authUser.id,
            reason: reason || null,
        });

        // Update setting
        await db
            .update(systemSettings)
            .set({
                value,
                updatedBy: authUser.id,
                updatedAt: new Date(),
            })
            .where(eq(systemSettings.key, key));

        return NextResponse.json({
            success: true,
            message: 'Setting updated successfully',
            key,
            value,
            previousValue: currentSetting.value,
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        return NextResponse.json(
            { error: 'Failed to update setting' },
            { status: 500 }
        );
    }
}

// Get setting history
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser || authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { key } = body;

        if (!key) {
            return NextResponse.json(
                { error: 'Missing key' },
                { status: 400 }
            );
        }

        const history = await db
            .select()
            .from(systemSettingsHistory)
            .where(eq(systemSettingsHistory.settingKey, key))
            .orderBy(systemSettingsHistory.createdAt);

        return NextResponse.json({
            key,
            history,
            total: history.length,
        });
    } catch (error) {
        console.error('Error fetching setting history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch setting history' },
            { status: 500 }
        );
    }
}
