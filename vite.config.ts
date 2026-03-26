import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    minify: false,
    rollupOptions: {
      input: 'src/webview/index.tsx',
      output: {
        entryFileNames: 'webview.js',
      },
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist since Extension TS compiler might run parallel or separate
  },
});
