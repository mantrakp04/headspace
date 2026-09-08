'use client';

import Image from 'next/image';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Disc3,
  ExternalLink,
  Heart,
  House,
  Library,
  ListMusic,
  ListPlus,
  LoaderCircle,
  Menu,
  MonitorSpeaker,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Sun,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useSpotify } from '@/hooks/use-spotify';
import {
  api,
  authorize,
  clientKey,
  collections,
  formatTime,
  list,
  object,
  pagePath,
  parseCollection,
  redirectUri,
  tracks,
  type Collection,
  type Track,
} from '@/lib/spotify';

type View =
  | { kind: 'home' }
  | { kind: 'search' }
  | { kind: 'library' }
  | { kind: 'liked' }
  | { kind: 'recent' }
  | { kind: 'collection'; collection: Collection };
type Filter = 'track' | 'album' | 'artist' | 'playlist' | 'show';
type Results = {
  tracks: Track[];
  collections: Collection[];
  next: string | null;
};
const emptyResults = (): Results => ({
  tracks: [],
  collections: [],
  next: null,
});
const moods = [
  {
    name: 'Find your focus',
    hint: 'A little less noise.',
    query: 'deep focus instrumental',
    className: 'focus',
    icon: AudioLines,
    number: '01',
  },
  {
    name: 'Feel good',
    hint: 'Let the sunshine in.',
    query: 'feel good indie',
    className: 'happy',
    icon: Sun,
    number: '02',
  },
  {
    name: 'Slow things down',
    hint: 'No rush. Just rhythm.',
    query: 'chill downtempo',
    className: 'chill',
    icon: Waves,
    number: '03',
  },
  {
    name: 'After hours',
    hint: 'Somewhere softer.',
    query: 'ambient sleep',
    className: 'sleep',
    icon: Moon,
    number: '04',
  },
];
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function Cover({
  image,
  name,
  className = '',
}: {
  image?: string;
  name: string;
  className?: string;
}) {
  return (
    <span className={`cover ${className}`}>
      {image ? (
        <Image
          unoptimized
          width={160}
          height={160}
          src={image}
          alt={name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
      ) : (
        <Disc3 aria-hidden="true" />
      )}
    </span>
  );
}
function SpotifyMark() {
  return (
    <span className="spotify-label">
      <Radio size={17} aria-hidden="true" />
      Spotify
    </span>
  );
}

export function MusicApp() {
  const spotify = useSpotify();
  const [view, setView] = useState<View>({ kind: 'home' });
  const [connectOpen, setConnectOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [callback, setCallback] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [filter, setFilter] = useState<Filter>('track');
  const [libraryFilter, setLibraryFilter] =
    useState<Collection['kind']>('playlist');
  const [results, setResults] = useState<Results>(emptyResults);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [playlists, setPlaylists] = useState<Collection[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addTrack, setAddTrack] = useState<Track | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [clock, setClock] = useState(0);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [volumePreview, setVolumePreview] = useState<number | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const requestId = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const currentTrack = spotify.playback.track;
  const progress =
    seekPreview ??
    Math.min(
      currentTrack?.duration || 0,
      spotify.playback.progress +
        (spotify.playback.playing
          ? Math.max(0, clock - spotify.playback.updatedAt)
          : 0),
    );
  const currentUri = currentTrack?.uri;
  const volume = volumePreview ?? spotify.playback.device?.volume ?? 50;
  const requireConnection = () => {
    if (spotify.connected) return true;
    setConnectOpen(true);
    return false;
  };
  useEffect(() => {
    if (window.location.hostname === 'localhost') {
      const url = new URL(window.location.href);
      url.hostname = '127.0.0.1';
      window.location.replace(url);
      return;
    }
    // eslint-disable-next-line react/react-compiler -- Read browser-only storage after hydration.
    setClientId(localStorage.getItem(clientKey) || '');
    setCallback(redirectUri());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (sleepAt !== null && clock >= sleepAt) {
      // eslint-disable-next-line react/react-compiler -- A wall-clock timer completing is an external event.
      setSleepAt(null);
      if (spotify.playback.playing)
        void spotify.pause().then((ok) => {
          if (ok) setNotice('Sleep timer finished. Music paused.');
        });
    }
  }, [clock, sleepAt, spotify]);
  useEffect(() => {
    if (!spotify.connected) {
      // eslint-disable-next-line react/react-compiler -- Clear account data when the external Spotify session ends.
      setPlaylists([]);
      setRecent([]);
      setResults(emptyResults());
      setSaved(new Set());
      setQueue([]);
      setSleepAt(null);
      return;
    }
    let ignore = false;
    api('/me/playlists?limit=50')
      .then((d) => {
        if (!ignore) setPlaylists(collections(object(d).items, 'playlist'));
      })
      .catch(spotify.report);
    api('/me/player/recently-played?limit=12')
      .then((d) => {
        if (!ignore) setRecent(tracks(object(d).items));
      })
      .catch(spotify.report);
    return () => {
      ignore = true;
    };
  }, [spotify.connected, spotify.report]);
  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    // eslint-disable-next-line react/react-compiler -- Reset the visible result while synchronizing a new Spotify request.
    setResults(emptyResults());
    setLoadError('');
    setLoading(false);
    if (
      !spotify.connected ||
      view.kind === 'home' ||
      (view.kind === 'search' && !submitted)
    )
      return;
    let path = '';
    if (view.kind === 'search')
      path =
        '/search?' +
        new URLSearchParams({ q: submitted, type: filter, limit: '10' });
    if (view.kind === 'liked') path = '/me/tracks?limit=50';
    if (view.kind === 'recent') path = '/me/player/recently-played?limit=50';
    if (view.kind === 'library')
      path =
        libraryFilter === 'playlist'
          ? '/me/playlists?limit=50'
          : libraryFilter === 'album'
            ? '/me/albums?limit=50'
            : libraryFilter === 'artist'
              ? '/me/following?type=artist&limit=50'
              : '/me/shows?limit=50';
    if (view.kind === 'collection') {
      const c = view.collection;
      path =
        c.kind === 'playlist'
          ? `/playlists/${c.id}/items?limit=50`
          : c.kind === 'album'
            ? `/albums/${c.id}/tracks?limit=50`
            : c.kind === 'artist'
              ? `/artists/${c.id}/albums?limit=50`
              : `/shows/${c.id}/episodes?limit=50`;
    }
    setLoading(true);
    api(path)
      .then((data) => {
        if (!cancelled && id === requestId.current) setResults(decode(data));
      })
      .catch((e) => {
        if (id === requestId.current)
          setLoadError(
            e instanceof Error ? e.message : 'Could not load your music.',
          );
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    function decode(data: unknown): Results {
      let page = object(data);
      if (view.kind === 'search')
        page = object(page[filter === 'show' ? 'shows' : filter + 's']);
      if (view.kind === 'library' && libraryFilter === 'artist')
        page = object(page.artists);
      const kind =
        view.kind === 'library'
          ? libraryFilter
          : view.kind === 'search' && filter !== 'track'
            ? filter
            : view.kind === 'collection' && view.collection.kind === 'artist'
              ? 'album'
              : null;
      let parsedTracks = kind
        ? []
        : tracks(page.items, typeof page.offset === 'number' ? page.offset : 0);
      if (view.kind === 'collection' && view.collection.kind === 'album')
        parsedTracks = parsedTracks.map((t) => ({
          ...t,
          image: view.collection.image,
          album: view.collection.name,
        }));
      if (view.kind === 'liked')
        setSaved((s) => new Set([...s, ...parsedTracks.map((t) => t.uri)]));
      return {
        tracks: parsedTracks,
        collections: kind ? collections(page.items, kind) : [],
        next: pagePath(page.next),
      };
    }
    return () => {
      cancelled = true;
    };
  }, [view, submitted, filter, libraryFilter, spotify.connected, retryKey]);
  useEffect(() => {
    if (!spotify.connected || !currentUri) return;
    let cancelled = false;
    api('/me/library/contains?uris=' + encodeURIComponent(currentUri))
      .then((data) => {
        if (!cancelled)
          setSaved((s) => {
            const copy = new Set(s);
            if (list(data)[0] === true) copy.add(currentUri);
            else copy.delete(currentUri);
            return copy;
          });
      })
      .catch(spotify.report);
    return () => {
      cancelled = true;
    };
  }, [currentUri, spotify.connected, spotify.report]);
  function navigate(next: View) {
    setView(next);
    setMobileOpen(false);
    setLoadError('');
  }
  function search(value: string, type: Filter = filter) {
    setQuery(value);
    setSubmitted(value.trim());
    setFilter(type);
    navigate({ kind: 'search' });
    if (!spotify.connected) setConnectOpen(true);
  }
  async function more() {
    if (!results.next || loading) return;
    const id = requestId.current;
    setLoading(true);
    try {
      const raw = object(await api(results.next));
      const page =
        view.kind === 'search'
          ? object(raw[filter === 'show' ? 'shows' : filter + 's'])
          : view.kind === 'library' && libraryFilter === 'artist'
            ? object(raw.artists)
            : raw;
      const kind =
        view.kind === 'library'
          ? libraryFilter
          : view.kind === 'search' && filter !== 'track'
            ? filter
            : view.kind === 'collection' && view.collection.kind === 'artist'
              ? 'album'
              : null;
      let added = kind
        ? []
        : tracks(page.items, typeof page.offset === 'number' ? page.offset : 0);
      if (view.kind === 'collection' && view.collection.kind === 'album')
        added = added.map((t) => ({
          ...t,
          image: view.collection.image,
          album: view.collection.name,
        }));
      if (id === requestId.current)
        setResults((prev) => ({
          tracks: [...prev.tracks, ...added],
          collections: [
            ...prev.collections,
            ...(kind ? collections(page.items, kind) : []),
          ],
          next: pagePath(page.next),
        }));
    } catch (e) {
      spotify.report(e);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  async function saveTrack(t: Track) {
    if (saving) return;
    setSaving(t.uri);
    try {
      const isSaved =
        saved.has(t.uri) ||
        list(
          await api('/me/library/contains?uris=' + encodeURIComponent(t.uri)),
        )[0] === true;
      await api(
        '/me/library?uris=' + encodeURIComponent(t.uri),
        isSaved ? 'DELETE' : 'PUT',
      );
      setSaved((s) => {
        const copy = new Set(s);
        if (isSaved) copy.delete(t.uri);
        else copy.add(t.uri);
        return copy;
      });
      if (isSaved && view.kind === 'liked')
        setResults((r) => ({
          ...r,
          tracks: r.tracks.filter((item) => item.uri !== t.uri),
        }));
      setNotice(
        isSaved ? 'Removed from Liked Songs.' : 'Saved to Liked Songs.',
      );
    } catch (e) {
      spotify.report(e);
    } finally {
      setSaving('');
    }
  }
  async function enqueue(t: Track) {
    if (
      await spotify.command(() =>
        api(
          '/me/player/queue?uri=' +
            encodeURIComponent(t.uri) +
            (spotify.playback.device?.id
              ? '&device_id=' + encodeURIComponent(spotify.playback.device.id)
              : ''),
          'POST',
        ),
      )
    )
      setNotice('Added to your Spotify queue.');
  }
  async function showQueue() {
    if (!requireConnection()) return;
    setQueueOpen(true);
    setQueueLoading(true);
    try {
      setQueue(tracks(object(await api('/me/player/queue')).queue));
    } catch (e) {
      spotify.report(e);
    } finally {
      setQueueLoading(false);
    }
  }
  async function createPlaylist() {
    if (!playlistName.trim() || creating) return;
    setCreating(true);
    try {
      const p = parseCollection(
        await api('/me/playlists', 'POST', {
          name: playlistName.trim(),
          public: false,
          description: 'Made in Sunroom',
        }),
        'playlist',
      );
      if (!p)
        throw new Error(
          'Spotify did not return the new playlist. Refresh your library before trying again.',
        );
      setPlaylists((old) => [p, ...old]);
      setCreateOpen(false);
      setPlaylistName('');
      navigate({ kind: 'collection', collection: p });
      setNotice('Your private playlist is ready.');
    } catch (e) {
      spotify.report(e);
    } finally {
      setCreating(false);
    }
  }
  async function addToPlaylist(p: Collection) {
    if (!addTrack || addBusy) return;
    setAddBusy(true);
    try {
      await api(`/playlists/${p.id}/items`, 'POST', { uris: [addTrack.uri] });
      setNotice(`Added to ${p.name}.`);
      setAddTrack(null);
      if (view.kind === 'collection' && view.collection.id === p.id)
        setRetryKey((k) => k + 1);
    } catch (e) {
      spotify.report(e);
    } finally {
      setAddBusy(false);
    }
  }
  const playFromTable = (items: Track[], index: number) =>
    spotify.play(
      items[index],
      items === results.tracks &&
        view.kind === 'collection' &&
        (view.collection.kind === 'album' ||
          view.collection.kind === 'playlist')
        ? view.collection.uri
        : undefined,
      items,
      items === results.tracks &&
        (view.kind === 'liked' ||
          (view.kind === 'collection' && view.collection.kind === 'show'))
        ? results.next
        : null,
      index,
    );
  const trackTable = (items: Track[], compact = false) => (
    <div className={`track-list ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="track-heading">
          <span>#</span>
          <span>Title</span>
          <span className="album-column">Album</span>
          <span>Time</span>
          <span />
        </div>
      )}
      {items.map((t, index) => (
        <div
          className={`track-row ${currentTrack?.uri === t.uri ? 'current-track' : ''}`}
          key={t.uri + index}
        >
          <IconButton
            label={`Play ${t.name}`}
            disabled={!t.playable || spotify.busy}
            onClick={() => void playFromTable(items, index)}
          >
            <span className="track-index">
              {currentTrack?.uri === t.uri && spotify.playback.playing ? (
                <AudioLines size={16} />
              ) : (
                index + 1
              )}
            </span>
            <Play className="row-play" size={15} fill="currentColor" />
          </IconButton>
          <div className="track-identity">
            <Cover image={t.image} name={t.album} />
            <span>
              <button
                className="track-title"
                onClick={() => void playFromTable(items, index)}
                disabled={!t.playable}
              >
                {t.name}
              </button>
              <small>
                {t.artist}
                {!t.playable ? ' · Unavailable' : ''}
              </small>
            </span>
          </div>
          {!compact && <span className="album-column ellipsis">{t.album}</span>}
          <span className="duration">{formatTime(t.duration)}</span>
          <div className="row-actions">
            <IconButton
              label={saved.has(t.uri) ? `Unlike ${t.name}` : `Like ${t.name}`}
              disabled={!!saving}
              active={saved.has(t.uri)}
              onClick={() => void saveTrack(t)}
            >
              <Heart fill={saved.has(t.uri) ? 'currentColor' : 'none'} />
            </IconButton>
            {!compact && (
              <>
                <IconButton
                  label={`Queue ${t.name}`}
                  disabled={spotify.busy || !t.playable}
                  onClick={() => void enqueue(t)}
                >
                  <ListPlus />
                </IconButton>
                <IconButton
                  label={`Add ${t.name} to playlist`}
                  onClick={() => setAddTrack(t)}
                >
                  <Plus />
                </IconButton>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="external-icon"
                    aria-label={`Open ${t.name} in Spotify`}
                    title="Open in Spotify"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
  const collectionGrid = (items: Collection[]) => (
    <div className="collection-grid">
      {items.map((c) => (
        <article className="collection-card" key={c.id}>
          <button
            onClick={() => navigate({ kind: 'collection', collection: c })}
          >
            <Cover
              image={c.image}
              name={c.name}
              className={c.kind === 'artist' ? 'artist-cover' : ''}
            />
            <h3>{c.name}</h3>
            <p>{c.subtitle}</p>
          </button>
          {c.url && (
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="source-link"
            >
              Spotify <ExternalLink size={12} />
            </a>
          )}
        </article>
      ))}
    </div>
  );
  const connectCard = (
    <div className="empty-state">
      <span className="empty-icon">
        <Music2 />
      </span>
      <h3>Your music belongs here.</h3>
      <p>
        Connect Spotify to bring your playlists, saved albums,
        <br className="desktop-only" /> and favorite songs into Sunroom.
      </p>
      <Button className="pill primary" onClick={() => setConnectOpen(true)}>
        Connect Spotify <ArrowRight size={16} />
      </Button>
      <small>Works with Spotify Premium</small>
    </div>
  );
  const title =
    view.kind === 'home'
      ? 'A little space for your music.'
      : view.kind === 'search'
        ? 'Find your next favorite.'
        : view.kind === 'library'
          ? 'Your collection.'
          : view.kind === 'liked'
            ? 'The ones you love.'
            : view.kind === 'recent'
              ? 'Back to a good thing.'
              : view.collection.name;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <button className="wordmark" onClick={() => navigate({ kind: 'home' })}>
          <span className="brand-dot" />
          sunroom<span className="brand-period">.</span>
        </button>
        <div className="sidebar-caption">MAKE YOURSELF AT HOME</div>
        <nav aria-label="Main navigation">
          {(
            [
              { kind: 'home', label: 'For you', icon: House },
              { kind: 'search', label: 'Explore', icon: Search },
              { kind: 'library', label: 'Your library', icon: Library },
            ] satisfies {
              kind: 'home' | 'search' | 'library';
              label: string;
              icon: typeof House;
            }[]
          ).map((n) => (
            <button
              key={n.kind}
              className={`nav-item ${view.kind === n.kind ? 'selected' : ''}`}
              onClick={() => {
                navigate({ kind: n.kind });
                if (n.kind === 'search')
                  setTimeout(() => searchInput.current?.focus(), 0);
              }}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {view.kind === n.kind && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">
          YOUR CORNER{' '}
          <IconButton
            label="Create playlist"
            onClick={() => {
              if (requireConnection()) setCreateOpen(true);
            }}
          >
            <Plus size={18} />
          </IconButton>
        </div>
        <button
          className={`nav-item ${view.kind === 'liked' ? 'selected' : ''}`}
          onClick={() => navigate({ kind: 'liked' })}
        >
          <Heart size={20} />
          <span>Liked songs</span>
        </button>
        <button
          className={`nav-item ${view.kind === 'recent' ? 'selected' : ''}`}
          onClick={() => navigate({ kind: 'recent' })}
        >
          <Disc3 size={20} />
          <span>Recently played</span>
        </button>
        <div className="sidebar-playlists">
          {playlists.slice(0, 8).map((p) => (
            <button
              key={p.id}
              onClick={() => navigate({ kind: 'collection', collection: p })}
            >
              <Cover image={p.image} name={p.name} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sun size={24} />
            <p>
              Good music.
              <br />A little room to breathe.
            </p>
          </div>
          <button
            className="connection-status"
            onClick={() =>
              spotify.connected ? setAccountOpen(true) : setConnectOpen(true)
            }
          >
            <span
              className={spotify.connected ? 'status-dot online' : 'status-dot'}
            />
            {spotify.connected
              ? 'Connected to Spotify'
              : 'Connect your Spotify'}
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-panel">
        <header className="topbar">
          <IconButton
            label="Open navigation"
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </IconButton>
          <div className="breadcrumb">
            Your daily listening room<span>/</span>
            <strong>
              {view.kind === 'home'
                ? 'For you'
                : view.kind === 'collection'
                  ? view.collection.kind
                  : view.kind === 'liked'
                    ? 'Liked songs'
                    : view.kind === 'recent'
                      ? 'Recently played'
                      : view.kind === 'library'
                        ? 'Your library'
                        : 'Explore'}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="spotify-top"
              onClick={() =>
                spotify.connected ? setAccountOpen(true) : setConnectOpen(true)
              }
            >
              <SpotifyMark />
              <span className="small-status">
                {spotify.connected ? 'CONNECTED' : 'CONNECT'}
              </span>
            </button>
            <IconButton
              label="Account and settings"
              className="account-button"
              onClick={() => setAccountOpen(true)}
            >
              {spotify.name ? (
                spotify.name.slice(0, 1).toUpperCase()
              ) : (
                <Settings2 size={18} />
              )}
            </IconButton>
          </div>
        </header>
        <div className="page-content">
          {spotify.error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={19} />
              <span>{spotify.error}</span>
              <IconButton
                label="Dismiss error"
                onClick={() => spotify.setError('')}
              >
                <X />
              </IconButton>
            </div>
          )}
          <div className="page-intro">
            <div>
              <p className="eyebrow">
                {view.kind === 'home'
                  ? spotify.name
                    ? `WELCOME BACK, ${spotify.name.split(' ')[0].toUpperCase()}`
                    : 'COME ON IN. TUNE THE WORLD OUT.'
                  : view.kind === 'collection'
                    ? view.collection.kind.toUpperCase()
                    : 'A SOUND FOR EVERY SIDE OF YOU'}
              </p>
              <h1>{title}</h1>
            </div>
            {view.kind === 'home' ? (
              <span className="intro-sun">
                <Sun size={39} strokeWidth={1.3} />
              </span>
            ) : (
              <IconButton
                label="Back to For you"
                onClick={() => navigate({ kind: 'home' })}
              >
                <ArrowLeft />
              </IconButton>
            )}
          </div>
          {view.kind === 'home' ? (
            <>
              <section className="welcome-banner">
                <div className="welcome-copy">
                  <span className="banner-tag">
                    <span />
                    YOUR DAILY RESET
                  </span>
                  <h2>
                    Less scrolling.
                    <br />
                    More feeling.
                  </h2>
                  <p>
                    Find a sound that meets you
                    <br />
                    right where you are.
                  </p>
                  <Button
                    className="pill dark"
                    onClick={() => search('chill electronic', 'track')}
                  >
                    <Play size={16} fill="currentColor" />
                    Find my flow
                  </Button>
                </div>
                <Image
                  unoptimized
                  width={1536}
                  height={1024}
                  priority
                  className="sunroom-art"
                  src="/images/sunroom.png"
                  alt="An orange sun listening peacefully to headphones among soft rolling hills"
                />
                <span className="banner-caption">
                  A GOOD DAY STARTS WITH A GOOD SONG.
                </span>
              </section>
              <section className="moods-section">
                <div className="section-heading">
                  <h2>How do you want to feel?</h2>
                  <span>Find your frequency</span>
                </div>
                <div className="mood-grid">
                  {moods.map((m) => (
                    <button
                      key={m.name}
                      className={`mood-card ${m.className}`}
                      onClick={() => search(m.query, 'track')}
                    >
                      <div className="mood-top">
                        <span>{m.number}</span>
                        <m.icon size={46} strokeWidth={1.4} />
                      </div>
                      <div>
                        <h3>{m.name}</h3>
                        <p>{m.hint}</p>
                      </div>
                      <span className="mood-arrow">
                        <ArrowRight size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="recent-section">
                <div className="section-heading">
                  <h2>
                    {spotify.connected
                      ? 'Pick up where you left off'
                      : 'All your favorites. Right at home.'}
                  </h2>
                  {spotify.connected && (
                    <button onClick={() => navigate({ kind: 'recent' })}>
                      View all <ArrowRight size={15} />
                    </button>
                  )}
                </div>
                {spotify.connected ? (
                  recent.length ? (
                    trackTable(recent.slice(0, 5))
                  ) : (
                    <div className="quiet-empty">
                      <Disc3 />
                      <p>
                        Your recent listening will appear here after you play
                        music on Spotify.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="connect-strip">
                    <div className="connect-strip-icon">
                      <Library size={28} />
                    </div>
                    <div>
                      <h3>Your library, a little lighter.</h3>
                      <p>
                        Same songs. Same playlists. A fresh place to listen.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="pill"
                      onClick={() => setConnectOpen(true)}
                    >
                      Bring my music <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
              </section>
              <div className="page-footer">
                <span>TAKE YOUR TIME. STAY A WHILE.</span>
                <span>
                  Music by{' '}
                  <a
                    href="https://www.spotify.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Spotify
                  </a>
                  <span className="footer-dot">·</span>Made for your own little
                  world
                </span>
              </div>
            </>
          ) : (
            <>
              {view.kind === 'search' && (
                <>
                  <form
                    className="search-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      search(query);
                    }}
                  >
                    <Search size={22} />
                    <Input
                      ref={searchInput}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Songs, artists, albums, or a feeling..."
                      aria-label="Search Spotify"
                    />
                    <Button
                      type="submit"
                      className="pill dark"
                      disabled={!query.trim()}
                    >
                      Search <ArrowRight size={16} />
                    </Button>
                  </form>
                  <div className="filter-row">
                    {(
                      [
                        'track',
                        'album',
                        'artist',
                        'playlist',
                        'show',
                      ] satisfies Filter[]
                    ).map((f) => (
                      <button
                        key={f}
                        className={filter === f ? 'active' : ''}
                        onClick={() => setFilter(f)}
                      >
                        {f === 'track'
                          ? 'Songs'
                          : f === 'show'
                            ? 'Podcasts'
                            : f[0].toUpperCase() + f.slice(1) + 's'}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {view.kind === 'library' && (
                <div className="filter-row">
                  {(
                    [
                      'playlist',
                      'album',
                      'artist',
                      'show',
                    ] satisfies Collection['kind'][]
                  ).map((f) => (
                    <button
                      key={f}
                      className={libraryFilter === f ? 'active' : ''}
                      onClick={() => setLibraryFilter(f)}
                    >
                      {f === 'show'
                        ? 'Podcasts'
                        : f[0].toUpperCase() + f.slice(1) + 's'}
                    </button>
                  ))}
                  <Button
                    variant="ghost"
                    className="create-playlist"
                    onClick={() => {
                      if (requireConnection()) setCreateOpen(true);
                    }}
                  >
                    <Plus />
                    New playlist
                  </Button>
                </div>
              )}
              {view.kind === 'collection' && (
                <div className="collection-header">
                  <Cover
                    image={view.collection.image}
                    name={view.collection.name}
                  />
                  <div>
                    <p>{view.collection.subtitle}</p>
                    <div className="collection-actions">
                      {['playlist', 'album'].includes(view.collection.kind) && (
                        <Button
                          className="pill dark"
                          disabled={spotify.busy}
                          onClick={() => {
                            if (requireConnection())
                              void spotify.play(undefined, view.collection.uri);
                          }}
                        >
                          <Play size={16} fill="currentColor" />
                          Play
                        </Button>
                      )}
                      {view.collection.url && (
                        <a
                          href={view.collection.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Spotify <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!spotify.connected ? (
                connectCard
              ) : loadError ? (
                <div className="empty-state" role="alert">
                  <CircleHelp />
                  <h3>Could not load this music.</h3>
                  <p>{loadError}</p>
                  <Button
                    className="pill"
                    onClick={() => setRetryKey((k) => k + 1)}
                  >
                    Try again
                  </Button>
                </div>
              ) : loading &&
                !results.tracks.length &&
                !results.collections.length ? (
                <output className="empty-state">
                  <LoaderCircle className="spin" />
                  <p>Making room for your music...</p>
                </output>
              ) : (
                <>
                  {results.collections.length > 0 &&
                    collectionGrid(results.collections)}
                  {results.tracks.length > 0 && trackTable(results.tracks)}
                  {!results.tracks.length && !results.collections.length && (
                    <div className="empty-state">
                      <Search />
                      <h3>
                        {view.kind === 'search'
                          ? submitted
                            ? 'Nothing here just yet.'
                            : 'Follow your curiosity.'
                          : 'Room for something good.'}
                      </h3>
                      <p>
                        {view.kind === 'search'
                          ? 'Try a favorite artist, a song, or a mood.'
                          : view.kind === 'collection'
                            ? 'This collection has no available items. Some Spotify playlists only expose their contents to their owner or collaborators.'
                            : 'Your saved music will appear here. Find something you love in Explore.'}
                      </p>
                      {view.kind === 'search' && !submitted && (
                        <div className="suggestions">
                          {[
                            'Zedd',
                            'Fred again..',
                            'Bonobo',
                            'Peaceful piano',
                          ].map((q) => (
                            <button key={q} onClick={() => search(q)}>
                              {q}
                              <ArrowRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {results.next && (
                    <div className="load-more">
                      <Button
                        className="pill"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void more()}
                      >
                        {loading ? 'Loading...' : 'Show more'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
      <footer className="player-bar" aria-label="Music player">
        <div className="now-playing">
          <Cover
            image={currentTrack?.image}
            name={currentTrack?.album || 'Nothing playing'}
          />
          <div>
            <strong>{currentTrack?.name || 'A little quiet, for now.'}</strong>
            <span>
              {currentTrack?.artist || 'Connect Spotify and find your flow'}
            </span>
          </div>
          {currentTrack && (
            <IconButton
              label={
                saved.has(currentTrack.uri)
                  ? 'Remove current song from Liked Songs'
                  : 'Like current song'
              }
              active={saved.has(currentTrack.uri)}
              disabled={!!saving}
              onClick={() => void saveTrack(currentTrack)}
            >
              <Heart
                fill={saved.has(currentTrack.uri) ? 'currentColor' : 'none'}
              />
            </IconButton>
          )}
        </div>
        <div className="player-center">
          <div className="playback-buttons">
            <IconButton
              label="Shuffle"
              active={spotify.playback.shuffle}
              disabled={!spotify.connected || spotify.busy}
              onClick={() => void spotify.shuffle()}
            >
              <Shuffle />
            </IconButton>
            <IconButton
              label="Previous track"
              disabled={!spotify.connected || spotify.busy}
              onClick={() => void spotify.skip('previous')}
            >
              <SkipBack fill="currentColor" />
            </IconButton>
            <Button
              className="main-play"
              aria-label={spotify.playback.playing ? 'Pause' : 'Play'}
              disabled={spotify.busy || spotify.initializing}
              onClick={() => {
                if (requireConnection()) void spotify.toggle();
              }}
            >
              {spotify.busy ? (
                <LoaderCircle className="spin" />
              ) : spotify.playback.playing ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </Button>
            <IconButton
              label="Next track"
              disabled={!spotify.connected || spotify.busy}
              onClick={() => void spotify.skip('next')}
            >
              <SkipForward fill="currentColor" />
            </IconButton>
            <IconButton
              label={`Repeat: ${spotify.playback.repeat}`}
              active={spotify.playback.repeat !== 'off'}
              disabled={!spotify.connected || spotify.busy}
              onClick={() => void spotify.repeat()}
            >
              {spotify.playback.repeat === 'track' ? <Repeat1 /> : <Repeat />}
            </IconButton>
          </div>
          <div className="progress-row">
            <span>{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              max={currentTrack?.duration || 1}
              step={1000}
              aria-label="Playback position"
              disabled={!currentTrack || spotify.busy}
              onValueChange={(value) =>
                setSeekPreview(Array.isArray(value) ? value[0] : value)
              }
              onValueCommitted={(value) => {
                void spotify
                  .seek(Array.isArray(value) ? value[0] : value)
                  .finally(() => setSeekPreview(null));
              }}
            />
            <span>{formatTime(currentTrack?.duration || 0)}</span>
          </div>
        </div>
        <div className="player-extras">
          <IconButton
            label="Sleep timer"
            active={sleepAt !== null}
            onClick={() => {
              if (requireConnection()) setTimerOpen(true);
            }}
          >
            <Moon />
          </IconButton>
          <IconButton
            label="Queue"
            active={queueOpen}
            onClick={() => void showQueue()}
          >
            <ListMusic />
          </IconButton>
          <IconButton
            label="Devices"
            active={deviceOpen}
            onClick={() => {
              if (requireConnection()) {
                setDeviceOpen(true);
                void spotify.loadDevices();
              }
            }}
          >
            <MonitorSpeaker />
          </IconButton>
          <div className="volume-control">
            <Volume2 size={19} />
            <Slider
              value={[volume]}
              aria-label="Volume"
              disabled={
                !spotify.connected ||
                spotify.busy ||
                (!!spotify.playback.device &&
                  spotify.playback.device.volume === null &&
                  spotify.playback.device.id !== spotify.browserDevice)
              }
              onValueChange={(value) =>
                setVolumePreview(Array.isArray(value) ? value[0] : value)
              }
              onValueCommitted={(value) => {
                void spotify
                  .volume(Array.isArray(value) ? value[0] : value)
                  .finally(() => setVolumePreview(null));
              }}
            />
          </div>
        </div>
      </footer>
      {notice && (
        <output className="toast">
          <Check size={18} />
          {notice}
        </output>
      )}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sunroom-dialog connect-dialog">
          <span className="dialog-symbol">
            <Radio size={30} />
          </span>
          <DialogTitle>Make yourself at home.</DialogTitle>
          <DialogDescription>
            Connect your Spotify Premium account to listen to full tracks,
            browse your library, and control your devices.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAuthBusy(true);
              setAuthError('');
              authorize(clientId).catch((error) => {
                setAuthError(
                  error instanceof Error ? error.message : 'Could not connect.',
                );
                setAuthBusy(false);
              });
            }}
          >
            <label htmlFor="client-id">Spotify app Client ID</label>
            <Input
              id="client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Paste your 32-character Client ID"
              autoComplete="off"
              required
            />
            <details>
              <summary>
                First time? A quick setup <ChevronRight size={15} />
              </summary>
              <ol>
                <li>
                  Open the{' '}
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Spotify Developer Dashboard <ExternalLink size={12} />
                  </a>{' '}
                  and create an app. Select Web API and Web Playback SDK.
                </li>
                <li>
                  Add this exact redirect URI in the app settings.
                  <div className="copy-field">
                    <code>{callback}</code>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(callback)
                          .then(() => setNotice('Redirect URI copied.'))
                          .catch(() =>
                            setAuthError('Copy the redirect URI shown above.'),
                          )
                      }
                    >
                      Copy
                    </button>
                  </div>
                </li>
                <li>
                  Add your Spotify account under User Management if required,
                  then paste the app Client ID above.
                </li>
              </ol>
              <p>
                Your Client ID is public. You never need to enter a client
                secret here.
              </p>
            </details>
            {authError && (
              <p role="alert" className="form-error">
                {authError}
              </p>
            )}
            <Button
              type="submit"
              className="pill primary full-width"
              disabled={authBusy}
            >
              {authBusy ? (
                <LoaderCircle className="spin" />
              ) : (
                <Radio size={18} />
              )}
              Continue with Spotify
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="dialog-footnote">
            Sign-in happens on Spotify. Tokens stay in this browser tab. Sunroom
            is an independent personal player.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={deviceOpen} onOpenChange={setDeviceOpen}>
        <DialogContent className="sunroom-dialog">
          <DialogTitle>Where are we listening?</DialogTitle>
          <DialogDescription>
            Choose a Spotify Connect device. Open Spotify on another device to
            make it available.
          </DialogDescription>
          <div className="device-list">
            {spotify.browserDevice &&
              !spotify.devices.some((d) => d.id === spotify.browserDevice) && (
                <button
                  onClick={() => void spotify.transfer(spotify.browserDevice)}
                  disabled={spotify.busy}
                >
                  <MonitorSpeaker />
                  <span>
                    Sunroom<small>This browser</small>
                  </span>
                </button>
              )}
            {spotify.devices.map((d) => (
              <button
                key={d.id}
                disabled={spotify.busy || d.restricted}
                className={d.active ? 'active' : ''}
                onClick={() => void spotify.transfer(d.id)}
              >
                <MonitorSpeaker />
                <span>
                  {d.name}
                  <small>
                    {d.active
                      ? 'Listening here'
                      : d.restricted
                        ? 'Device cannot be controlled'
                        : 'Available'}
                  </small>
                </span>
                {d.active && <Check />}
              </button>
            ))}
          </div>
          {!spotify.devices.length && !spotify.browserDevice && (
            <p className="muted">
              No devices available yet. Open Spotify, then refresh. Browser
              audio may require Chrome or Safari.
            </p>
          )}
          <Button
            variant="outline"
            className="pill"
            onClick={() => void spotify.loadDevices()}
          >
            Refresh devices
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="sunroom-dialog queue-dialog">
          <DialogTitle>Coming up next.</DialogTitle>
          <DialogDescription>Your live Spotify queue.</DialogDescription>
          {queueLoading ? (
            <LoaderCircle className="spin" />
          ) : queue.length ? (
            <div className="queue-list">
              {queue.map((t, i) => (
                <div className="queue-item" key={t.uri + i}>
                  <span>{i + 1}</span>
                  <Cover image={t.image} name={t.album} />
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.artist}</small>
                  </span>
                  <span>{formatTime(t.duration)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              The queue is empty. Add a song using the queue button beside it.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="sunroom-dialog">
          <DialogTitle>Your little corner.</DialogTitle>
          <DialogDescription>
            {spotify.connected
              ? `Connected${spotify.name ? ' as ' + spotify.name : ' to Spotify'}. Your playlists and listening stay with your Spotify account.`
              : 'Bring your Spotify Premium account to Sunroom.'}
          </DialogDescription>
          <div className="account-detail">
            <Music2 />
            <span>
              Full-track playback, search, playlists, saved music, queue, and
              Spotify Connect.
            </span>
          </div>
          <p className="muted">
            Offline downloads, Spotify lyrics, AI DJ, and its personalized Home
            feed are not available in this player. API access depends on your
            Spotify app permissions.
          </p>
          {spotify.connected ? (
            <Button
              variant="outline"
              className="pill"
              onClick={() => {
                spotify.logout();
                setAccountOpen(false);
                navigate({ kind: 'home' });
              }}
            >
              Disconnect Spotify
            </Button>
          ) : (
            <Button
              className="pill primary"
              onClick={() => {
                setAccountOpen(false);
                setConnectOpen(true);
              }}
            >
              Connect Spotify
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sunroom-dialog">
          <DialogTitle>A new place for your favorites.</DialogTitle>
          <DialogDescription>
            Create a private playlist in your Spotify account.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createPlaylist();
            }}
          >
            <label htmlFor="playlist-name">Playlist name</label>
            <Input
              id="playlist-name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Sunday kind of feeling"
              maxLength={100}
              required
            />
            <Button
              type="submit"
              className="pill primary full-width"
              disabled={creating || !playlistName.trim()}
            >
              {creating ? 'Creating...' : 'Create playlist'}
              <Plus size={16} />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={addTrack !== null}
        onOpenChange={(open) => {
          if (!open) setAddTrack(null);
        }}
      >
        <DialogContent className="sunroom-dialog">
          <DialogTitle>Add to a playlist.</DialogTitle>
          <DialogDescription>
            {addTrack?.name}. Choose a playlist you own or can edit.
          </DialogDescription>
          <div className="playlist-choices">
            {playlists.map((p) => (
              <button
                key={p.id}
                disabled={addBusy}
                onClick={() => void addToPlaylist(p)}
              >
                <Cover image={p.image} name={p.name} />
                <span>{p.name}</span>
                <Plus size={17} />
              </button>
            ))}
          </div>
          {!playlists.length && (
            <p>Create a playlist from Your corner first.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={timerOpen} onOpenChange={setTimerOpen}>
        <DialogContent className="sunroom-dialog">
          <DialogTitle>Drift off. We will pause.</DialogTitle>
          <DialogDescription>
            {sleepAt
              ? `Music pauses in ${Math.max(1, Math.ceil((sleepAt - clock) / 60000))} minutes.`
              : 'Choose when to pause your music. Keep this tab open for the timer to work.'}
          </DialogDescription>
          <div className="timer-options">
            {[15, 30, 45, 60].map((minutes) => (
              <Button
                key={minutes}
                variant="outline"
                className="pill"
                onClick={() => {
                  setSleepAt(Date.now() + minutes * 60000);
                  setTimerOpen(false);
                  setNotice(`Music will pause in ${minutes} minutes.`);
                }}
              >
                {minutes} min
              </Button>
            ))}
          </div>
          {sleepAt && (
            <Button
              variant="ghost"
              onClick={() => {
                setSleepAt(null);
                setTimerOpen(false);
              }}
            >
              Cancel timer
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
