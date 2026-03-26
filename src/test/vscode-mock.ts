import { vi } from 'vitest';

export const window = {
    createOutputChannel: vi.fn().mockReturnValue({
        appendLine: vi.fn(),
    }),
};

export const workspace = {
    getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn(),
        update: vi.fn(),
    }),
};
