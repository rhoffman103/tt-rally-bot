import type { Config } from '@react-router/dev/config';

export default {
  // SPA mode: no runtime server rendering. The root route is pre-rendered
  // at build time into build/client/index.html.
  ssr: false,
} satisfies Config;
