import { parseGraphSON, formatProfileData, formatExplainData } from '../graphsonFormatting';

describe('parseGraphSON', () => {
    it('passes through null and primitives', () => {
        expect(parseGraphSON(null)).toBeNull();
        expect(parseGraphSON('plain')).toBe('plain');
    });

    it('unwraps scalar GraphSON types', () => {
        expect(parseGraphSON({ '@type': 'g:Int64', '@value': 42 })).toBe(42);
    });

    it('unwraps g:List/g:Set into arrays', () => {
        expect(parseGraphSON({ '@type': 'g:List', '@value': [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('unwraps g:Map into a plain object, recursing into values', () => {
        const input = {
            '@type': 'g:Map',
            '@value': ['k1', 'v1', 'k2', { '@type': 'g:Int32', '@value': 5 }],
        };
        expect(parseGraphSON(input)).toEqual({ k1: 'v1', k2: 5 });
    });

    it('recurses into plain object properties', () => {
        const input = { a: { '@type': 'g:Int32', '@value': 1 }, b: 'plain' };
        expect(parseGraphSON(input)).toEqual({ a: 1, b: 'plain' });
    });
});

describe('formatProfileData', () => {
    it('renders a header and metric rows for a well-formed profile', () => {
        const rawData = [{
            dur: 12.345678,
            metrics: [{
                name: 'TinkerGraphStep',
                counts: { traverserCount: 5 },
                dur: 1.2,
                percDur: 50.5,
            }],
        }];

        const output = formatProfileData(rawData);

        expect(output).toContain('Dur: 12.3457 ms');
        expect(output).toContain('TinkerGraphStep');
        expect(output).toContain('50.50');
    });

    it('falls back to pretty-printed JSON when there is no metrics field', () => {
        const rawData = { foo: 'bar' };
        expect(formatProfileData(rawData)).toBe(JSON.stringify(rawData, null, 2));
    });
});

describe('formatExplainData', () => {
    it('renders original and final traversal sections', () => {
        const rawData = [{ original: ['step1', 'step2'], final: 'finalStep' }];
        const output = formatExplainData(rawData);

        expect(output).toContain('Original Traversal');
        expect(output).toContain('step1');
        expect(output).toContain('step2');
        expect(output).toContain('Final Traversal');
        expect(output).toContain('finalStep');
    });

    it('falls back to pretty-printed JSON when there is nothing to explain', () => {
        expect(formatExplainData(null)).toBe('null');
    });
});
