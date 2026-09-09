import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import stylesheet from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Headspace — Your music. In a different headspace.' },
      {
        name: 'description',
        content:
          'The original lime-green Windows Media Player skin, brought back to life on macOS with Spotify, visualizations, and built-in updates.',
      },
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
