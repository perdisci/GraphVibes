import { getId, getSafeKey, formatResult } from '../gremlinIds';

describe('getId', () => {
    it('extracts the id property from an element-like object', () => {
        expect(getId({ id: 5, label: 'person' })).toBe(5);
    });

    it('returns primitives unchanged', () => {
        expect(getId(5)).toBe(5);
        expect(getId('abc')).toBe('abc');
    });

    it('returns the object itself when it has no id property', () => {
        const obj = { label: 'no-id' };
        expect(getId(obj)).toBe(obj);
    });
});

describe('getSafeKey', () => {
    it('returns primitives unchanged', () => {
        expect(getSafeKey(5)).toBe(5);
        expect(getSafeKey('abc')).toBe('abc');
    });

    it('produces a deterministic key regardless of key order', () => {
        expect(getSafeKey({ b: 1, a: 2 })).toBe(getSafeKey({ a: 2, b: 1 }));
        expect(getSafeKey({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
    });

    it('falls back to a stringified empty object when there is nothing to key on', () => {
        expect(getSafeKey({})).toBe('{}');
    });

    it('uses a custom toString() when the object has no enumerable keys', () => {
        class CompositeId {
            toString() {
                return 'composite-123';
            }
        }
        expect(getSafeKey(new CompositeId())).toBe('composite-123');
    });
});

describe('formatResult', () => {
    it('passes through null/undefined/primitives', () => {
        expect(formatResult(null)).toBeNull();
        expect(formatResult(undefined)).toBeUndefined();
        expect(formatResult('hello')).toBe('hello');
    });

    it('converts bigint to number', () => {
        expect(formatResult(10n)).toBe(10);
    });

    it('converts a Map into a plain object with string keys', () => {
        const map = new Map([['a', 1], ['b', 2]]);
        expect(formatResult(map)).toEqual({ a: 1, b: 2 });
    });

    it('recurses into arrays and nested objects', () => {
        const input = [{ x: 1, y: new Map([['z', 2n]]) }];
        expect(formatResult(input)).toEqual([{ x: 1, y: { z: 2 } }]);
    });
});
