/**
 * Guards for client-supplied Socket.IO payloads.
 *
 * Socket.IO calls a handler with whatever the client sent, including nothing at all, so a handler
 * that destructures its first argument throws inside the library's dispatch and, uncaught, takes the
 * whole process down. Everything here is plain CommonJS with no dependencies so the Dockerfile's
 * `COPY . .` ships it and the unit tests can require it directly.
 */

/** Longest match / competition id accepted from a client. Real ids are UUIDs or short slugs. */
const MAX_ID_LENGTH = 64;

/** Most rooms one socket may sit in (its own id room and the environment room count too). */
const MAX_ROOMS_PER_SOCKET = 20;

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A usable id: a non-empty string of at most MAX_ID_LENGTH characters. */
function isValidId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/** Returns the payload when it is an object, otherwise null. */
function asObject(payload) {
    return isPlainObject(payload) ? payload : null;
}

/** Returns payload.matchId when the payload is an object with a valid matchId, otherwise null. */
function getMatchId(payload) {
    return isPlainObject(payload) && isValidId(payload.matchId) ? payload.matchId : null;
}

/**
 * Wrap a socket event handler so it can never throw into Socket.IO's dispatch: synchronous errors
 * are caught, and a returned promise (async handlers) gets a catch so a rejection is not unhandled.
 * The handler's own return value is not used by Socket.IO, so nothing is lost.
 */
function guarded(name, handler, log = console.error) {
    return (...args) => {
        try {
            const result = handler(...args);
            if (result && typeof result.catch === 'function') {
                result.catch((err) => log(`[WS] Handler "${name}" rejected:`, err));
            }
        } catch (err) {
            log(`[WS] Handler "${name}" threw:`, err);
        }
    };
}

/** True when the socket may join `roomName`: it is already in it, or it is under the room cap. */
function canJoinRoom(rooms, roomName, max = MAX_ROOMS_PER_SOCKET) {
    return rooms.has(roomName) || rooms.size < max;
}

module.exports = {
    MAX_ID_LENGTH,
    MAX_ROOMS_PER_SOCKET,
    isValidId,
    asObject,
    getMatchId,
    guarded,
    canJoinRoom,
};
