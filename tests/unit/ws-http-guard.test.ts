import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

const require = createRequire(import.meta.url);
const { isAuthorizedApiKey, readBodyLimited, MAX_BODY_BYTES } = require('../../ws-server/http-guard.js');

describe('isAuthorizedApiKey', () => {
    it('accepts only the exact configured key', () => {
        expect(isAuthorizedApiKey('secret-key', 'secret-key')).toBe(true);
        expect(isAuthorizedApiKey('secret-key-2', 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey('SECRET-KEY', 'secret-key')).toBe(false);
    });

    it('fails closed when the server key is unset or empty (the old undefined === undefined hole)', () => {
        expect(isAuthorizedApiKey(undefined, undefined)).toBe(false);
        expect(isAuthorizedApiKey(undefined, '')).toBe(false);
        expect(isAuthorizedApiKey('', '')).toBe(false);
        expect(isAuthorizedApiKey('anything', undefined)).toBe(false);
        expect(isAuthorizedApiKey('anything', '')).toBe(false);
    });

    it('rejects a missing or non-string header', () => {
        expect(isAuthorizedApiKey(undefined, 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey(['secret-key'], 'secret-key')).toBe(false);
        expect(isAuthorizedApiKey('', 'secret-key')).toBe(false);
    });
});

function fakeReqRes() {
    const req: any = new EventEmitter();
    req.destroyed = false;
    req.destroy = () => { req.destroyed = true; };
    const res: any = { status: 0, headers: {} as any, body: '', ended: false };
    res.writeHead = (s: number, h: any) => { res.status = s; res.headers = h; };
    res.end = (b?: string) => { res.body = b ?? ''; res.ended = true; };
    return { req, res };
}

describe('readBodyLimited', () => {
    it('delivers the body for a small request', () => {
        const { req, res } = fakeReqRes();
        let got: string | null = null;
        readBodyLimited(req, res, MAX_BODY_BYTES, (b: string) => { got = b; });
        req.emit('data', Buffer.from('{"room":"match:1",'));
        req.emit('data', Buffer.from('"event":"x"}'));
        req.emit('end');
        expect(got).toBe('{"room":"match:1","event":"x"}');
        expect(res.ended).toBe(false);
    });

    it('answers 413, destroys the request and never calls back when the body is too large', () => {
        const { req, res } = fakeReqRes();
        let called = false;
        readBodyLimited(req, res, 10, () => { called = true; });
        req.emit('data', Buffer.from('12345678'));
        req.emit('data', Buffer.from('90abcdef'));
        req.emit('end');
        expect(res.status).toBe(413);
        expect(req.destroyed).toBe(true);
        expect(called).toBe(false);
    });
});
