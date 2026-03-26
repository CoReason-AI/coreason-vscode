import { describe, it, expect, vi } from 'vitest';
import { fetchTopologySchema } from '../extension/network/edgeClient';

describe('edgeClient', () => {
    it('returns schema string on successful HTTP 200 response', async () => {
        const fakeSchema = '{"type": "object", "properties": {}}';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            text: async () => fakeSchema,
        }));

        const result = await fetchTopologySchema();
        expect(result).toBe(fakeSchema);

        vi.unstubAllGlobals();
    });

    it('returns null on ECONNREFUSED or other errors', async () => {
        const fakeError = new Error('ECONNREFUSED');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(fakeError));

        const result = await fetchTopologySchema();
        expect(result).toBeNull();

        vi.unstubAllGlobals();
    });
});
