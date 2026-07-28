import { validateConnectionTarget } from '../validateConnection';

describe('validateConnectionTarget', () => {
    afterEach(() => {
        delete process.env.GREMLIN_ALLOWED_HOSTS;
    });

    it('accepts a typical localhost target', () => {
        expect(validateConnectionTarget('localhost', '8182')).toEqual({ valid: true });
    });

    it('accepts an IPv4 host and a numeric port', () => {
        expect(validateConnectionTarget('192.168.1.1', 8182)).toEqual({ valid: true });
    });

    it('accepts docker-network-style hostnames', () => {
        expect(validateConnectionTarget('my_janus-graph.internal', '8182')).toEqual({ valid: true });
    });

    it('rejects an empty host', () => {
        expect(validateConnectionTarget('', '8182').valid).toBe(false);
    });

    it('rejects hosts containing whitespace or path/URL-breaking characters', () => {
        expect(validateConnectionTarget('bad host', '8182').valid).toBe(false);
        expect(validateConnectionTarget('evil.com/../x', '8182').valid).toBe(false);
        expect(validateConnectionTarget('evil.com@attacker', '8182').valid).toBe(false);
    });

    it('rejects out-of-range or non-numeric ports', () => {
        expect(validateConnectionTarget('localhost', 0).valid).toBe(false);
        expect(validateConnectionTarget('localhost', 70000).valid).toBe(false);
        expect(validateConnectionTarget('localhost', 'abc').valid).toBe(false);
    });

    it('is unrestricted by default (no GREMLIN_ALLOWED_HOSTS set)', () => {
        expect(validateConnectionTarget('anything.example.com', '8182').valid).toBe(true);
    });

    it('honors GREMLIN_ALLOWED_HOSTS as an opt-in allowlist', () => {
        process.env.GREMLIN_ALLOWED_HOSTS = 'a.example.com, b.example.com';
        expect(validateConnectionTarget('a.example.com', '8182').valid).toBe(true);
        expect(validateConnectionTarget('evil.example.com', '8182').valid).toBe(false);
    });
});
