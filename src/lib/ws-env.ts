/**
 * Which environment's rooms a server-side broadcast lands in on the shared ws-server.
 *
 * An explicit WS_ENV ('prod' or 'staging') always wins. Without it the deployment's own URL is
 * matched against the two known staging hostnames and anything else is 'prod'. That default is
 * unsafe for a Vercel preview URL (it is not a staging hostname, so it would post into the 'prod'
 * rooms), which is why `previewMayHitProd` is reported so the caller can warn about it.
 */
export type WsEnv = 'prod' | 'staging';

export interface WsEnvResolution {
    env: WsEnv;
    source: 'explicit' | 'heuristic';
    /** True when the URL is a *.vercel.app host and the result is still 'prod'. */
    previewMayHitProd: boolean;
}

export function parseWsEnv(value: string | undefined | null): WsEnv | null {
    const v = (value ?? '').trim().toLowerCase();
    return v === 'prod' || v === 'staging' ? v : null;
}

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return url.trim().toLowerCase();
    }
}

export function resolveWsEnv(explicit: string | undefined | null, appUrl: string): WsEnvResolution {
    const forced = parseWsEnv(explicit);
    if (forced) return { env: forced, source: 'explicit', previewMayHitProd: false };

    const env: WsEnv =
        appUrl.includes('staging.brixsports.com') || appUrl.includes('brixsports-staging.vercel.app')
            ? 'staging'
            : 'prod';
    return {
        env,
        source: 'heuristic',
        previewMayHitProd: env === 'prod' && hostnameOf(appUrl).endsWith('.vercel.app'),
    };
}
