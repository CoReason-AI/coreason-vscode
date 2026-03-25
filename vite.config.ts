import { defineConfig } from 'vite';

export default defineConfig({
  build: {
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
