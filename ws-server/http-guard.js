/**
 * Guards for the ws-server's HTTP endpoints (/broadcast, /infrastructure/endpoint).
 *
 * Plain CommonJS with no dependencies so the Dockerfile's `COPY . .` ships it and the unit tests
 * can require it directly.
 */
const crypto = require('crypto');

/** Hard cap on a request body. The real payloads (a match event, a score) are a few KB. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Constant-time API key check that FAILS CLOSED.
 *
 * The previous check was `apiKey !== process.env.WS_API_KEY`: when the variable is unset on the
 * service, a request with no `x-api-key` header made `undefined !== undefined` false and was
 * accepted, so anyone could inject events and scores into the match rooms. An empty or missing
 * configured key now rejects every request.
 */
function isAuthorizedApiKey(provided, expected) {
    if (typeof expected !== 'string' || expected.length === 0) return false;
    if (typeof provided !== 'string' || provided.length === 0) return false;
    // Hash both sides so timingSafeEqual always compares equal-length buffers.
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

/**
 * Read a request body with a size cap. Calls `onBody(bodyString)` when complete; if the body is
 * larger than `maxBytes` the request gets 413 and is destroyed, and `onBody` is never called.
 */
function readBodyLimited(req, res, maxBytes, onBody) {
    let size = 0;
    const chunks = [];
    let aborted = false;
    req.on('data', (chunk) => {
        if (aborted) return;
        size += chunk.length;
        if (size > maxBytes) {
            aborted = true;
            res.writeHead(413, { 'Content-Type': 'application/json', Connection: 'close' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        if (aborted) return;
        onBody(Buffer.concat(chunks).toString('utf8'));
    });
}

module.exports = { MAX_BODY_BYTES, isAuthorizedApiKey, readBodyLimited };
