import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with server-side environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/cloudinary/sign
 * Generate a signature for secure Cloudinary uploads
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paramsToSign } = body;

    // Validate Cloudinary is configured
    if (!process.env.CLOUDINARY_API_SECRET && !process.env.CLOUDINARY_API_KEY) {
      console.error('[Cloudinary Sign] Missing Cloudinary credentials');
      return NextResponse.json(
        { error: 'Cloudinary not configured. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables.' },
        { status: 500 }
      );
    }

    if (!paramsToSign) {
      return NextResponse.json(
        { error: 'Missing paramsToSign in request body' },
        { status: 400 }
      );
    }

    // Generate signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp: paramsToSign.timestamp,
    });
  } catch (error) {
    console.error('[Cloudinary Sign] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signature', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cloudinary/sign
 * Check Cloudinary configuration status
 */
export async function GET() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const isConfigured = !!(cloudName && apiKey && apiSecret);

  return NextResponse.json({
    configured: isConfigured,
    cloudName: cloudName || null,
    hasApiKey: !!apiKey,
    hasApiSecret: !!apiSecret,
    message: isConfigured ? 'Cloudinary is configured' : 'Cloudinary is not fully configured',
  });
}
