// BACKLOG-212 item 7: `LivestreamPlayer` renders 'custom'/'hls'/'dash' stream URLs
// directly as an iframe src with no host check at all -- only http/https scheme was
// validated. The write path is admin-only (PATCH /api/matches/[id]/livestream), so
// this isn't an unauthenticated-attacker XSS the way BUG-006 was, but an admin
// pasting (or a compromised admin session submitting) an arbitrary URL still gets
// embedded with allow-scripts/allow-forms/allow-popups sandbox permissions -- a real
// phishing/clickjacking surface against viewers who trust the page. 'youtube'/'twitch'/
// 'facebook' types never hit this: they only ever extract an ID and build a URL
// against a fixed trusted domain, regardless of what the admin pastes.

export const ALLOWED_LIVESTREAM_EMBED_HOSTS = [
    // Direct youtube/twitch/facebook links pasted under the 'custom' type
    'www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
    'player.twitch.tv', 'twitch.tv', 'www.twitch.tv',
    'www.facebook.com', 'facebook.com',
    // Common third-party video hosts a university media team might actually use
    'player.vimeo.com', 'vimeo.com',
    'iframe.videodelivery.net', 'customer-media.cloudflarestream.com',
    'stream.mux.com', 'player.mux.com',
    // Cloudinary is an already-configured project dependency (image + video delivery)
    'res.cloudinary.com',
] as const;

export function isAllowedLivestreamEmbedHost(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        return ALLOWED_LIVESTREAM_EMBED_HOSTS.some(
            host => url.hostname === host || url.hostname.endsWith(`.${host}`)
        );
    } catch {
        return false;
    }
}
