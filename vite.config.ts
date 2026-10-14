import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the app from /tt-rally-bot/. Keep in step with `basename` in react-router.config.ts.
  base: '/tt-rally-bot/',
  plugins: [tailwindcss(), reactRouter()],
  optimizeDeps: {
    // React Router gives Vite no files to scan, so in dev Vite finds a library only when a screen first uses it,
    // then reloads the page. The reload drops the Bluetooth link to the robot. Scanning the routes up front finds
    // every library before the app starts.
    entries: ['app/root.tsx', 'app/routes/*.tsx'],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
