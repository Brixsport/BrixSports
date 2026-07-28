/**
 * Competition Templates API
 * GET /api/competitions/templates - Get all templates or filter by sport/format/level
 * POST /api/competitions/templates/apply - Apply a template to create a competition
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { competitions } from '@/db/schema';
import { nanoid } from 'nanoid';
import {
    COMPETITION_TEMPLATES,
    getTemplateById,
    getTemplatesBySport,
    getTemplatesByFormat,
    getTemplatesByLevel,
} from '@/lib/competition-templates';
import { getAuthUser } from '@/lib/auth';

/**
 * GET - Get competition templates
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sport = searchParams.get('sport');
        const format = searchParams.get('format');
        const level = searchParams.get('level');
        const id = searchParams.get('id');

        let templates = COMPETITION_TEMPLATES;

        if (id) {
            const template = getTemplateById(id);
            return NextResponse.json({
                template: template || null,
            });
        }

        if (sport) {
            templates = getTemplatesBySport(sport);
        } else if (format) {
            templates = getTemplatesByFormat(format);
        } else if (level) {
            templates = getTemplatesByLevel(level);
        }

        return NextResponse.json({
            templates,
            total: templates.length,
        });
    } catch (error) {
        console.error('[Competition Templates API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch templates' },
            { status: 500 }
        );
    }
}

/**
 * POST - Apply a template to create a competition
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser(request);
        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (authUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { templateId, name, season, startDate, endDate, customRules } = body;

        if (!templateId || !season) {
            return NextResponse.json(
                { error: 'templateId and season are required' },
                { status: 400 }
            );
        }

        const template = getTemplateById(templateId);
        if (!template) {
            return NextResponse.json(
                { error: 'Template not found' },
                { status: 404 }
            );
        }

        // Merge template rules with custom rules if provided
        const rules = customRules
            ? { ...template.rules, ...customRules }
            : template.rules;

        const newCompetition = {
            id: nanoid(),
            name: name || template.name,
            sport: template.sport,
            format: template.format,
            season,
            status: 'upcoming' as const,
            numberOfTeams: template.numberOfTeams,
            numberOfGroups: template.numberOfGroups || 0,
            teamsPerGroup: template.teamsPerGroup || 0,
            level: template.level,
            scope: template.scope,
            rules: JSON.stringify(rules),
            description: template.description,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            followersCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const inserted = await db.insert(competitions).values(newCompetition).returning();

        return NextResponse.json({
            success: true,
            competition: inserted[0],
            appliedTemplate: template.name,
        }, { status: 201 });
    } catch (error) {
        console.error('[Competition Templates API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to apply template' },
            { status: 500 }
        );
    }
}
