import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getAuthUser } from '@/lib/auth';

// Configure Cloudinary with server-side environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Only these keys may be signed. Anything else (eager, notification_url,
// transformation, type, access_mode, ...) is refused so a signature can't be
// minted for an arbitrary upload/admin-API call.
const ALLOWED_SIGN_KEYS = new Set([
  'timestamp', 'folder', 'public_id', 'upload_preset', 'source', 'callback',
  'tags', 'context', 'overwrite', 'unique_filename', 'use_filename',
]);
const ALLOWED_FOLDER_ROOT = 'brixsports/';
const SAFE_PATH = /^[A-Za-z0-9_\-/]+$/;
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 60;

/** Returns an error message if paramsToSign is not acceptable, else null. */
function validateParamsToSign(params: unknown): string | null {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return 'paramsToSign must be an object';
  }
  const p = params as Record<string, unknown>;

  for (const [key, value] of Object.entries(p)) {
    if (!ALLOWED_SIGN_KEYS.has(key)) return `Parameter not allowed: ${key}`;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return `Invalid value for ${key}`;
    }
  }

  const ts = Number(p.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return 'timestamp is missing or out of range';
  }

  if (p.folder !== undefined) {
    const folder = String(p.folder);
    if (!folder.startsWith(ALLOWED_FOLDER_ROOT) || folder.includes('..') || !SAFE_PATH.test(folder)) {
      return `folder must be under ${ALLOWED_FOLDER_ROOT}`;
    }
  }

  if (p.public_id !== undefined) {
    const publicId = String(p.public_id);
    if (publicId.includes('..') || !SAFE_PATH.test(publicId)) {
      return 'public_id contains invalid characters';
    }
    // Without a pinned folder, public_id is the full path and must itself stay in the root.
    if (p.folder === undefined && !publicId.startsWith(ALLOWED_FOLDER_ROOT)) {
      return `public_id must be under ${ALLOWED_FOLDER_ROOT}`;
    }
  }

  if (p.upload_preset !== undefined) {
    const expectedPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'brix_uploads';
    if (p.upload_preset !== expectedPreset) return 'upload_preset not allowed';
  }

  return null;
}

/**
 * POST /api/cloudinary/sign
 * Generate a signature for secure Cloudinary uploads (admin only, allow-listed params)
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Every in-repo uploader (admin player/news/competition/ads image pickers) is admin-only.
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const invalid = validateParamsToSign(paramsToSign);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 422 });
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
      { error: 'Failed to generate signature' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cloudinary/sign
 * Check Cloudinary configuration status
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
