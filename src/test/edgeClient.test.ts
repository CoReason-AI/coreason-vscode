import { describe, it, expect, vi } from 'vitest';
import { fetchTopologySchema } from '../extension/network/edgeClient';

describe('edgeClient', () => {
    it('returns schema string on successful HTTP 200 response', async () => {
        const expectedSchema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "CoReason Topology Manifest",
            "$defs": {},
            "anyOf": [
                { "$ref": "swarm" },
                { "$ref": "dag" }
            ]
        };
        const mockFetch = vi.fn().mockImplementation(async (url: string) => {
            return { ok: true, json: async () => (expectedSchema) };
        });
        vi.stubGlobal('fetch', mockFetch);

        const result = await fetchTopologySchema();
        expect(result).toBe(JSON.stringify(expectedSchema));

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

import { executeSandbox, resumeOracleWorkflow, synthesizeAgent, sendForgeApprovalAttestation } from '../extension/network/edgeClient';

describe('edgeClient extended methods', () => {
    it('executeSandbox returns receipt on success', async () => {
        const mockReceipt = { intent_hash: '123', success: true };
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockReceipt }));
        const result = await executeSandbox('tool', { intent: 'a', state: 'b' });
        expect(result.success).toBe(true);
        vi.unstubAllGlobals();
    });

    it('executeSandbox handles fallback on error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('error msg')));
        const result = await executeSandbox('tool', { intent: 'a', state: 'b' });
        expect(result.success).toBe(false);
        vi.unstubAllGlobals();
    });

    it('resumeOracleWorkflow triggers HTTP resolution', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        const result = await resumeOracleWorkflow('wf_1', '{}');
        expect(result).toBe(true);
        vi.unstubAllGlobals();
    });

    it('resumeOracleWorkflow handles error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('err')));
        const result = await resumeOracleWorkflow('wf_1', '{}');
        expect(result).toBe(false);
        vi.unstubAllGlobals();
    });

    it('synthesizeAgent fetches vector pipeline', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ res: 'ok' }) }));
        const result = await synthesizeAgent('test');
        expect(result.res).toBe('ok');
        vi.unstubAllGlobals();
    });

    it('synthesizeAgent handles error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('err')));
        const result = await synthesizeAgent('test');
        expect(result).toBeNull();
        vi.unstubAllGlobals();
    });

    it('sendForgeApprovalAttestation transmits fido signatures', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        const result = await sendForgeApprovalAttestation('wf1', 'sig');
        expect(result).toBe(true);
        vi.unstubAllGlobals();
    });

    it('sendForgeApprovalAttestation handles error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('err')));
        const result = await sendForgeApprovalAttestation('wf1', 'sig');
        expect(result).toBe(false);
        vi.unstubAllGlobals();
    });

    it('handles HTTP error status codes correctly for all endpoints', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        expect(await fetchTopologySchema()).toBeNull();
        const box = await executeSandbox('tool', { intent: 'a', state: 'b' });
        expect(box.success).toBe(false);
        expect(await resumeOracleWorkflow('wf1', '{}')).toBe(false);
        expect(await synthesizeAgent('test')).toBeNull();
        expect(await sendForgeApprovalAttestation('wf1', 'sig')).toBe(false);
        vi.unstubAllGlobals();
    });
});
