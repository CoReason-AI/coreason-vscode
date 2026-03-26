import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

declare global {
  var acquireVsCodeApi: () => any;
}

global.acquireVsCodeApi = () => ({
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
});
