import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { PlayerPreview } from '../components/player-preview';

import {
  siteUrl,
  siteTitle,
  siteDescription,
  shareImage,
  shareImageAlt,
} from '../seo';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: siteTitle },
      { name: 'description', content: siteDescription },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Headspace for Mac' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:url', content: siteUrl },
      { property: 'og:title', content: siteTitle },
      { property: 'og:description', content: siteDescription },
      { property: 'og:image', content: shareImage },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: shareImageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:creator', content: '@barre_of_lube' },
      { name: 'twitter:title', content: siteTitle },
      { name: 'twitter:description', content: siteDescription },
      { name: 'twitter:image', content: shareImage },
      { name: 'twitter:image:alt', content: shareImageAlt },
    ],
    links: [{ rel: 'canonical', href: siteUrl }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Headspace for Mac',
          url: siteUrl,
          description: siteDescription,
          image: shareImage,
          operatingSystem: 'macOS 14 or later',
          applicationCategory: 'MultimediaApplication',
          downloadUrl:
            'https://github.com/mantrakp04/headspace/releases/latest/download/Headspace.dmg',
          softwareRequirements:
            'Apple silicon Mac. Spotify Premium and internet connection required for full playback.',
          author: {
            '@type': 'Person',
            name: 'barrel of lube',
            url: 'https://x.com/barre_of_lube',
          },
        }),
      },
    ],
  }),
  component: Home,
});
const repository = 'https://github.com/mantrakp04/headspace';
const twitter = 'https://x.com/barre_of_lube';

function AppleMark() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 16.97 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2c.13 1.17-.34 2.35-1.04 3.19C14.21 6.04 13.07 6.7 11.95 6.61 11.8 5.46 12.36 4.26 13 3.5Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.438 6.231H2.71l7.51-8.583L1.25 2.25h6.93l4.26 5.638 5.804-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function Home() {
  const [playerReady, setPlayerReady] = useState(false);
  return (
    <main
      className="landing"
      data-player-ready={playerReady}
      data-theme="flyer"
    >
      <nav className="landing-nav page-chrome" aria-label="Main navigation">
        <Link className="landing-wordmark" to="/" aria-label="Headspace home">
          headspace
        </Link>
      </nav>
      <header className="hero-heading page-chrome">
        <h1>
          The 2000s <em>are back.</em>
        </h1>
      </header>
      <section className="player-space" aria-label="Try the Headspace player">
        <span
          className="stage-coordinate coordinate-left page-chrome"
          aria-hidden="true"
        >
          STEREO SOUND
          <br />
          PERSONAL AUDIO
        </span>
        <PlayerPreview onReady={() => setPlayerReady(true)} />
        <span
          className="stage-coordinate coordinate-right page-chrome"
          aria-hidden="true"
        >
          ORIGINAL SKIN
          <br />
          NEW FREQUENCY
        </span>
      </section>
      <div className="hero-download page-chrome">
        <p className="player-hint">
          A retro Spotify player for Mac. Try three previews, no sign-in.
        </p>
        <a
          className="landing-download"
          href={`${repository}/releases/latest/download/Headspace.dmg`}
        >
          <AppleMark /> Download for Mac
        </a>
        <p className="landing-requirements">
          Apple silicon · macOS 14+ · Spotify Premium
        </p>
      </div>
      <footer className="landing-footer page-chrome">
        <div className="footer-social">
          <a href={twitter} aria-label="barrel of lube on X">
            <XMark />
          </a>
          <a href={repository} aria-label="Headspace on GitHub">
            <GitHubMark />
          </a>
        </div>
        <p>
          Revived by <a href={twitter}>barrel of lube</a>. Skin © 2000 Microsoft
          / Carolyn Farino.
          <br />
          <span>
            Independent project. Not affiliated with Microsoft, Spotify, or
            Headspace meditation.
          </span>
        </p>
        <a href={`${repository}/releases`}>
          Releases <ArrowUpRight size={12} />
        </a>
      </footer>
    </main>
  );
}
