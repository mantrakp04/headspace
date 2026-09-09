import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import Headspace from './headspace';

const root = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <a href="/">Open Headspace</a>,
});
const player = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: Headspace,
});
export const router = createRouter({ routeTree: root.addChildren([player]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
