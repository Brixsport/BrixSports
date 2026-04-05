import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API route to serve llms.txt with proper headers
 * This ensures AI crawlers get the correct content-type
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const isFullVersion = url.searchParams.get('full') === 'true';
    
    try {
        const filename = isFullVersion ? 'llms-full.txt' : 'llms.txt';
        const filePath = join(process.cwd(), 'public', filename);
        const content = readFileSync(filePath, 'utf-8');
        
        return new NextResponse(content, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
                'X-Robots-Tag': 'all',
            },
        });
    } catch {
        return NextResponse.json(
            { error: 'File not found' },
            { status: 404 }
        );
    }
}
