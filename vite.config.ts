import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Windows: a shell can report the project as "c:\..." while the OS real path is "C:\...". Part of the
// module resolution canonicalises the drive letter and part does not, so Rolldown saw every package
// twice ("c:/…/react" and "C:/…/react") and bundled React and React Router twice — blank pages with
// "Cannot read properties of null (reading 'useContext')". Build from the canonical path only.
const root = realpathSync.native(process.cwd());
if (root !== process.cwd()) process.chdir(root);

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  // Only VITE_* variables could ever reach the browser; BriefRoom defines none. The client
  // reads its public configuration from GET /api/config at runtime instead.
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@shared': resolve(root, 'shared'),
    },
    // Note: do NOT add `dedupe` for react here — with Rolldown it split react-router's context
    // ("Cannot destructure property 'basename' of useContext(...)"). Consistent alias casing is the fix.
  },
  server: {
    host: true, // reachable from phones on the same Wi-Fi
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1800,
    rolldownOptions: {
      output: {
        // React must exist exactly once. Without explicit groups Rolldown duplicated the React CJS
        // module into two shared chunks, which breaks hooks ("reading 'useState' of null").
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/, priority: 30 },
            { name: 'ui-vendor', test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui|motion|framer-motion|motion-dom|motion-utils|sonner|lucide-react|class-variance-authority|clsx|tailwind-merge|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|tslib|get-nonce|detect-node-es)[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
});
