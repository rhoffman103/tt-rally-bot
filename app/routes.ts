import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('drills/:id', 'routes/drill.tsx'),
  route('builder/new', 'routes/builder.tsx', { id: 'builder-new' }),
  route('builder/:id', 'routes/builder.tsx', { id: 'builder-edit' }),
  route('plans', 'routes/plans.tsx'),
  route('plans/new', 'routes/plan-editor.tsx', { id: 'plan-new' }),
  route('plans/:id', 'routes/plan.tsx'),
  route('plans/:id/edit', 'routes/plan-editor.tsx', { id: 'plan-edit' }),
  route('import', 'routes/import.tsx'),
  route('settings', 'routes/settings.tsx'),
] satisfies RouteConfig;
