import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'src/test/suite/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        exclude: [
            'src/test/**/*',
            'dist/**/*',
            'src/shared/types.ts',
            'src/**/*.d.ts'
        ]
    }
  },
  resolve: {
    alias: {
      vscode: '/src/test/vscode-mock.ts',
    },
  },
});
