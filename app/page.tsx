import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowDown,
  ArrowUpRight,
  Code2,
  Headphones,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import './landing.css';

const repository = 'https://github.com/mantrakp04/headspace';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (typeof query.code === 'string' || typeof query.error === 'string') {
    const callback = new URLSearchParams();
    for (const key of ['code', 'state', 'error', 'error_description']) {
      const value = query[key];
      if (typeof value === 'string') callback.set(key, value);
    }
    redirect('/listen?' + callback.toString());
  }
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="landing-wordmark" href="/" aria-label="Headspace home">
          headspace<span>for Mac</span>
        </Link>
        <div>
          <a href="#the-player">The player</a>
          <a href={`${repository}/releases`}>
            Releases <ArrowUpRight size={15} />
          </a>
          <a href={repository} aria-label="Headspace source on GitHub">
            <Code2 size={20} />
          </a>
        </div>
      </nav>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-eyebrow">
            <span /> A small app. A very big personality.
          </p>
          <h1 id="landing-title">
            Your music.
            <br />
            In a different
            <br />
            <em>headspace.</em>
          </h1>
          <p className="landing-intro">
            A little Windows Media Player nostalgia, now on your Mac. The
            original lime-green skin, brought back to life with your Spotify
            library.
          </p>
          <a
            className="landing-download"
            href={`${repository}/releases/latest/download/Headspace.dmg`}
          >
            <ArrowDown size={20} /> Download for Mac <span>↗</span>
          </a>
          <p className="landing-requirements">
            Apple silicon · macOS 14+ · Spotify Premium
          </p>
        </div>
        <div className="landing-art">
          <span className="landing-art-label">
            EST. 2000 / REWIRED FOR TODAY
          </span>
          <div className="landing-orbit" aria-hidden="true" />
          <Image
            src="/headspace/head.png"
            alt="The original Headspace skin: a lime-green head with a dark music display and purple control panel"
            width={278}
            height={386}
            priority
            unoptimized
          />
          <span className="landing-sticker">
            Still a little
            <br />
            <strong>weird.</strong>
          </span>
          <p>Same face. New place to play.</p>
        </div>
        <div className="landing-index" aria-hidden="true">
          <span>01 — THE COMEBACK</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section
        className="landing-details"
        id="the-player"
        aria-labelledby="details-title"
      >
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Made for the music</p>
          <h2 id="details-title">
            Less dashboard.
            <br />
            More desktop companion.
          </h2>
        </div>
        <div className="landing-feature-grid">
          <article>
            <Headphones />
            <span>01 / YOUR COLLECTION</span>
            <h3>Your Spotify, right here.</h3>
            <p>
              Search, play your albums, open your playlists, and find your liked
              songs. Music streams inside the app.
            </p>
          </article>
          <article>
            <Sparkles />
            <span>02 / A LITTLE ATMOSPHERE</span>
            <h3>Give your desktop a pulse.</h3>
            <p>
              Sliding speaker panels, jeweled controls, and seven
              visualizations. Float it above your windows and settle in.
            </p>
          </article>
          <article>
            <RefreshCw />
            <span>03 / BUILT TO STICK AROUND</span>
            <h3>A classic that keeps up.</h3>
            <p>
              A native Mac window, secure sign-in with Keychain storage, and
              built-in updates. Small rituals, fewer interruptions.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-install" aria-labelledby="install-title">
        <p className="landing-eyebrow">
          Three steps to a better-looking desktop
        </p>
        <h2 id="install-title">Download. Drag. Drop a track.</h2>
        <p>
          Open the disk image and drag Headspace into Applications. Launch it,
          connect Spotify from the library, and pick something good.
        </p>
        <a href={`${repository}/releases`}>
          Release notes & downloads <ArrowUpRight size={18} />
        </a>
      </section>
      <footer className="landing-footer">
        <Link className="landing-wordmark" href="/">
          headspace
        </Link>
        <p>
          An independent revival by{' '}
          <a href="https://github.com/mantrakp04">mantra patel</a>.<br />
          Original skin © 2000 Microsoft, designed by Carolyn Farino. Not
          affiliated with Microsoft, Spotify, or the Headspace meditation app.
        </p>
        <a href={repository}>
          Open source <ArrowUpRight size={16} />
        </a>
      </footer>
    </main>
  );
}
