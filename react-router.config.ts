import type { Config } from '@react-router/dev/config';

export default {
  // SPA mode: no runtime server rendering. The root route is pre-rendered
  // at build time into build/client/index.html.
  ssr: false,
  // GitHub Pages serves the app from /tt-rally-bot/. Keep in step with `base` in vite.config.ts.
  basename: '/tt-rally-bot/',
} satisfies Config;
