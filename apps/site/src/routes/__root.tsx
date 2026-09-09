import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import stylesheet from '../styles.css?url';
import { useEffect } from 'react';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'stylesheet', href: stylesheet },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main style={{ padding: 48, color: '#f0f0e8', fontFamily: 'sans-serif' }}>
      <h1>Page not found</h1>
      <a href="/">Back to Headspace</a>
    </main>
  ),
});

function Root() {
  useEffect(() => {
    void import('../analytics').catch((cause: unknown) => {
      console.error('Could not initialize Hexclave analytics', cause);
    });
  }, []);
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
