import { SongCard } from './song-card';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  collections,
  decodeJson,
  disconnect,
  formatTime,
  isFiniteNumber,
  isJsonBoolean,
  isJsonString,
  list,
  object,
  pagePath,
  parseCollection,
  parseTrack,
  tracks,
  type Collection,
  type Track,
} from '@headspace/spotify';
import {
  completeSignIn,
  connectSpotify,
  initializeSession,
  native,
  nativeText,
  spotifyAPI,
  type LocalPlayback,
  type PlaybackCommandArgs,
} from './bridge';
import {
  startPlayer,
  disconnectPlayer,
  readPlayback,
  playbackCommand,
  playSelection,
} from './player';
import {
  Visualizer,
  visualizations,
  defaultVisualizerSettings,
  type VisualizerSettings,
} from './visualizer';
import sizes from './skin-dimensions.json';
import { Icon, SkinButton, type SkinIcon } from './skin-controls';
import './skin.css';
import './slider-detail.css';
import { useAudioCapture } from './audio';
import { Speakers } from './speakers';
import { PlaylistTracks, PreviewQueue, type PreviewPlayer } from './preview';
import {
  TrackRows,
  CollectionRows,
  QueueRows,
  PlaylistPicker,
} from './media-tables';

type Asset = keyof typeof sizes;
type Panel = 'library' | 'account' | 'devices' | 'queue' | 'about' | null;
type LibraryMode =
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'shows'
  | 'liked'
  | 'recent'
  | 'search'
  | 'collection';
const emptyPlayback: LocalPlayback = {
  running: false,
  playing: false,
  volume: 50,
  position: 0,
  shuffle: false,
  repeat: 'off',
  name: '',
  artist: '',
  album: '',
  uri: '',
  duration: 0,
  image: '',
};
function bitmap(name: Asset) {
  return '/skin/' + name + '.png';
}
function Bitmap({
  name,
  x = 0,
  y = 0,
  className = '',
  style,
}: {
  name: Asset;
  x?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (name === 'head' || name === 'left_ear' || name === 'right_ear') {
    const { width, height } = sizes[name];
    const filter = `skin-edge-${name}`;
    return (
      <svg
        className={`bitmap ${className}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
        style={{ left: x, top: y, ...style }}
      >
        <defs>
          {name !== 'head' && (
            <clipPath id={`${filter}-join`}>
              <rect
                x={name === 'left_ear' ? width - 2 : 0}
                y="0"
                width="2"
                height="160"
              />
            </clipPath>
          )}
          <filter id={filter} colorInterpolationFilters="sRGB">
            <feMorphology
              in="SourceAlpha"
              operator="erode"
              radius="1"
              result="interior"
            />
            <feComposite
              in="SourceGraphic"
              in2="interior"
              operator="in"
              result="originalInterior"
            />
            <feGaussianBlur
              in="originalInterior"
              stdDeviation="1"
              result="edgeColor"
            />
            <feColorMatrix
              in="edgeColor"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1"
              result="extendedColor"
            />
            <feComposite
              in="originalInterior"
              in2="extendedColor"
              operator="over"
              result="color"
            />
            <feGaussianBlur
              in="SourceAlpha"
              stdDeviation=".75"
              result="contour"
            />
            <feComponentTransfer in="contour" result="edge">
              <feFuncA type="linear" slope="3" intercept="-1" />
            </feComponentTransfer>
            <feComposite in="color" in2="edge" operator="in" />
          </filter>
        </defs>
        <image
          href={bitmap(name)}
          width={width}
          height={height}
          filter={`url(#${filter})`}
        />
        {name !== 'head' && (
          <image
            href={bitmap(name)}
            width={width}
            height={height}
            clipPath={`url(#${filter}-join)`}
          />
        )}
      </svg>
    );
  }
  return (
    <img
      className={`bitmap ${className}`}
      src={bitmap(name)}
      width={sizes[name].width}
      height={sizes[name].height}
      alt=""
      draggable={false}
      style={{ left: x, top: y, ...style }}
    />
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="classic-dialog" onCancel={close}>
      <div className="dialog-titlebar">
        <strong>{title}</strong>
        <button
          className="dialog-close"
          onClick={close}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

const BAND_PRESETS = [
  { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass boost', bands: [10, 9, 7, 4, 1, 0, 0, 0, 0, 0] },
  { name: 'Dance', bands: [8, 7, 4, 0, -3, -2, 2, 5, 7, 8] },
  { name: 'Vocals', bands: [-4, -3, 0, 4, 7, 8, 6, 2, -1, -3] },
  { name: 'Treble boost', bands: [0, 0, 0, 0, 1, 3, 5, 7, 9, 10] },
  { name: 'Rock', bands: [6, 4, 2, -2, -3, 0, 3, 5, 6, 6] },
  { name: 'Pop', bands: [-1, 2, 4, 5, 3, 0, -1, -1, 2, 3] },
  { name: 'Electronic', bands: [7, 6, 2, 0, -3, 1, 2, 4, 6, 7] },
  { name: 'Hip-hop', bands: [8, 7, 4, 2, -1, -1, 2, 3, 2, 1] },
  { name: 'Jazz', bands: [4, 3, 1, 2, -2, -2, 0, 2, 4, 5] },
  { name: 'Classical', bands: [4, 3, 2, 0, -2, -2, 0, 2, 3, 4] },
  { name: 'Acoustic', bands: [3, 3, 2, 1, 3, 4, 3, 2, 3, 4] },
  { name: 'Soft', bands: [-5, -4, -3, -2, -2, -3, -4, -5, -6, -7] },
];

export default function Headspace({ preview }: { preview?: PreviewPlayer }) {
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / 760, window.innerHeight / 394),
  );
  const [leftOpen, setLeftOpen] = useState(
    () => localStorage.getItem('headspace.leftOpen') !== 'false',
  );
  const [rightOpen, setRightOpen] = useState(
    () => localStorage.getItem('headspace.rightOpen') !== 'false',
  );
  const [vizSettings, setVizSettings] = useState<VisualizerSettings>(() => {
    if (preview) return defaultVisualizerSettings;
    try {
      const saved = object(
        decodeJson(
          localStorage.getItem('headspace.visualizerSettings') || 'null',
        ),
      );
      if (
        isFiniteNumber(saved.speed) &&
        saved.speed >= 0.25 &&
        saved.speed <= 2 &&
        isFiniteNumber(saved.glow) &&
        saved.glow >= 0.4 &&
        saved.glow <= 2 &&
        isFiniteNumber(saved.hue) &&
        saved.hue >= 0 &&
        saved.hue <= 1 &&
        isJsonBoolean(saved.frozen)
      )
        return {
          speed: saved.speed,
          glow: saved.glow,
          hue: saved.hue,
          frozen: saved.frozen,
        };
    } catch {
      /* Use the original settings if saved preferences are invalid. */
    }
    return defaultVisualizerSettings;
  });
  useEffect(() => {
    localStorage.setItem(
      'headspace.visualizerSettings',
      JSON.stringify(vizSettings),
    );
  }, [vizSettings]);
  const [vizOpen, setVizOpen] = useState(false);
  const [viz, setViz] = useState(() => {
    if (preview) return 7;
    const value = Number(
      localStorage.getItem('headspace.visualization') ?? (preview ? 7 : 0),
    );
    return Number.isInteger(value) &&
      value >= 0 &&
      value < visualizations.length
      ? value
      : 0;
  });
  useEffect(() => {
    localStorage.setItem('headspace.leftOpen', String(leftOpen));
    localStorage.setItem('headspace.rightOpen', String(rightOpen));
    localStorage.setItem('headspace.visualization', String(viz));
  }, [leftOpen, rightOpen, viz]);
  const [bands, setBands] = useState(Array<number>(10).fill(0));
  const [audioEnabled, setAudioEnabled] = useState(
    () => localStorage.getItem('headspace.audioResponse') !== 'off',
  );
  const [audioAttempt, setAudioAttempt] = useState(0);
  const audioStatus = useAudioCapture(!preview && audioEnabled, audioAttempt);
  useEffect(() => {
    localStorage.setItem(
      'headspace.audioResponse',
      audioEnabled ? 'on' : 'off',
    );
  }, [audioEnabled]);
  const [playback, setPlayback] = useState<LocalPlayback>(
    () => preview?.readPlayback() ?? emptyPlayback,
  );
  const [volume, setVolume] = useState<number | null>(null);
  const [seek, setSeek] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authURL, setAuthURL] = useState('');
  const [mode, setMode] = useState<LibraryMode>('recent');
  const [query, setQuery] = useState('');
  const [searchKind, setSearchKind] = useState<
    'track' | 'album' | 'artist' | 'playlist' | 'show'
  >('track');
  const [activeCollection, setActiveCollection] = useState<Collection | null>(
    null,
  );
  const [songList, setSongList] = useState<Track[]>([]);
  const [songContext, setSongContext] = useState<string | null>(null);
  const [songContinuation, setSongContinuation] = useState<string | null>(null);
  const [collectionList, setCollectionList] = useState<Collection[]>([]);
  const [playlists, setPlaylists] = useState<Collection[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueCurrent, setQueueCurrent] = useState<Track | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [queueRevision, setQueueRevision] = useState(0);
  const [devices, setDevices] = useState<
    { id: string; name: string; active: boolean }[]
  >([]);
  const [newPlaylist, setNewPlaylist] = useState('');
  const [adding, setAdding] = useState<Track | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const refreshing = useRef(false);
  const request = useRef(0);
  const locked = useRef(false);
  const report = useCallback(
    (cause: unknown) =>
      setError(
        cause instanceof Error ? cause.message : 'Spotify did not respond.',
      ),
    [],
  );
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      setPlayback(preview ? preview.readPlayback() : await readPlayback());
    } catch (e) {
      report(e);
    } finally {
      refreshing.current = false;
    }
  }, [preview, report]);
  const loadProfile = useCallback(async () => {
    const p = object(await spotifyAPI('/me'));
    setProfile(isJsonString(p.display_name) ? p.display_name : 'Spotify');
    setPlaylists(
      collections(
        object(await spotifyAPI('/me/playlists?limit=50')).items,
        'playlist',
      ),
    );
  }, []);
  useEffect(() => {
    const changed = () => void refresh();
    window.addEventListener('headspace-playback-changed', changed);
    return () =>
      window.removeEventListener('headspace-playback-changed', changed);
  }, [refresh]);
  useEffect(() => {
    if (panel !== 'queue' || !connected) return;
    let disposed = false;
    let inFlight = false;
    const update = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = object(await spotifyAPI('/me/player/queue'));
        if (disposed) return;
        setQueue(tracks(data.queue));
        setQueueCurrent(parseTrack(data.currently_playing));
        setQueueError('');
      } catch (e) {
        if (!disposed)
          setQueueError(
            e instanceof Error ? e.message : 'Could not load the queue.',
          );
      } finally {
        inFlight = false;
        if (!disposed) setQueueLoading(false);
      }
    };
    const initial = window.setTimeout(() => void update(), 0);
    let changeTimer = 0;
    const changed = () => {
      window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => void update(), 400);
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) void update();
    }, 5000);
    window.addEventListener('headspace-playback-changed', changed);
    document.addEventListener('visibilitychange', changed);
    return () => {
      disposed = true;
      window.clearTimeout(initial);
      window.clearTimeout(changeTimer);
      window.clearInterval(timer);
      window.removeEventListener('headspace-playback-changed', changed);
      document.removeEventListener('visibilitychange', changed);
    };
  }, [panel, connected, queueRevision]);
  useEffect(() => {
    const resize = () =>
      setScale(Math.min(window.innerWidth / 760, window.innerHeight / 394));
    window.addEventListener('resize', resize);
    if (preview) return () => window.removeEventListener('resize', resize);
    void initializeSession()
      .then(async (ok) => {
        void import('./analytics').catch((cause: unknown) => {
          console.error('Could not initialize Hexclave analytics', cause);
        });
        setConnected(ok);
        if (ok) {
          await loadProfile();
          await startPlayer();
        }
      })
      .catch(report);
    // oxlint-disable-next-line react/set-state-in-effect -- Read the embedded Spotify player when this subscription starts.
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 1600);
    const oauth = (event: WindowEventMap['headspace-oauth']) => {
      setAuthBusy(true);
      void completeSignIn(event.detail)
        .then(async (ok) => {
          setConnected(ok);
          if (ok) {
            await loadProfile();
            disconnectPlayer();
            await startPlayer();
            setPanel(null);
            setAuthURL('');
            setStatus('Spotify connected');
            setError('');
          }
        })
        .catch(report)
        .finally(() => setAuthBusy(false));
    };
    window.addEventListener('headspace-oauth', oauth);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('headspace-oauth', oauth);
    };
  }, [preview, refresh, report, loadProfile]);
  useEffect(() => {
    const onError = (event: WindowEventMap['headspace-player-error']) => {
      setError(event.detail);
    };
    window.addEventListener('headspace-player-error', onError);
    return () => window.removeEventListener('headspace-player-error', onError);
  }, []);
  useEffect(() => {
    if (!status || status === 'Preparing playback...') return;
    const timer = setTimeout(() => setStatus(''), 5000);
    return () => clearTimeout(timer);
  }, [status]);
  async function runControl(action: () => Promise<void>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
      window.dispatchEvent(new Event('headspace-playback-changed'));
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function control(method: string, args?: PlaybackCommandArgs) {
    if (preview) {
      return runControl(() => preview.command(method, args));
    }
    return runControl(() => playbackCommand(method, args));
  }
  async function signIn() {
    if (preview) {
      setStatus(
        'Download Headspace for Mac to connect Spotify and play music.',
      );
      return;
    }
    setAuthBusy(true);
    setError('');
    try {
      await connectSpotify();
      const url = window.headspaceNative ? await native('authURL') : '';
      setAuthURL(nativeText(url));
    } catch (e) {
      report(e);
    } finally {
      setAuthBusy(false);
    }
  }
  const libraryRequest = useCallback(
    async (
      selected: LibraryMode,
      search: string,
      type: typeof searchKind,
      collection: Collection | null,
      more?: string,
    ) => {
      const id = ++request.current;
      setLoading(true);
      setLibraryError('');
      setError('');
      if (!more) {
        setSongList([]);
        setSongContext(null);
        setSongContinuation(null);
        setCollectionList([]);
        setNext(null);
      }
      let path = more || '';
      if (!path) {
        switch (selected) {
          case 'playlists':
            path = '/me/playlists?limit=50';
            break;
          case 'albums':
            path = '/me/albums?limit=50';
            break;
          case 'artists':
            path = '/me/following?type=artist&limit=50';
            break;
          case 'shows':
            path = '/me/shows?limit=50';
            break;
          case 'liked':
            path = '/me/tracks?limit=50';
            break;
          case 'recent':
            path = '/me/player/recently-played?limit=50';
            break;
          case 'search':
            path =
              '/search?' +
              new URLSearchParams({ q: search, type, limit: '10' });
            break;
          case 'collection':
            if (!collection) {
              setLoading(false);
              return;
            }
            path =
              collection.kind === 'playlist'
                ? `/playlists/${collection.id}/items?limit=50`
                : collection.kind === 'album'
                  ? `/albums/${collection.id}/tracks?limit=50`
                  : collection.kind === 'artist'
                    ? `/artists/${collection.id}/albums?limit=50`
                    : `/shows/${collection.id}/episodes?limit=50`;
            break;
        }
      }
      try {
        const raw = object(await spotifyAPI(path));
        const page =
          selected === 'search'
            ? object(raw[type === 'show' ? 'shows' : type + 's'])
            : selected === 'artists'
              ? object(raw.artists)
              : raw;
        const kind =
          selected === 'playlists'
            ? 'playlist'
            : selected === 'albums'
              ? 'album'
              : selected === 'artists'
                ? 'artist'
                : selected === 'shows'
                  ? 'show'
                  : selected === 'search' && type !== 'track'
                    ? type
                    : selected === 'collection' && collection?.kind === 'artist'
                      ? 'album'
                      : null;
        let songs = kind
          ? []
          : tracks(page.items, isFiniteNumber(page.offset) ? page.offset : 0);
        if (collection?.kind === 'album' && selected === 'collection')
          songs = songs.map((t) => ({
            ...t,
            image: collection.image,
            album: collection.name,
          }));
        const groups = kind ? collections(page.items, kind) : [];
        if (id !== request.current) return;
        setSongList((old) => (more ? [...old, ...songs] : songs));
        setSongContext(
          selected === 'collection' &&
            collection &&
            (collection.kind === 'album' || collection.kind === 'playlist')
            ? collection.uri
            : null,
        );
        setCollectionList((old) => (more ? [...old, ...groups] : groups));
        setSongContinuation(
          selected === 'liked' ||
            (selected === 'collection' && collection?.kind === 'show')
            ? pagePath(page.next)
            : null,
        );
        setNext(selected === 'recent' ? null : pagePath(page.next));
        if (selected === 'liked')
          setSaved((old) => new Set([...old, ...songs.map((t) => t.uri)]));
      } catch (e) {
        if (id === request.current) {
          setLibraryError(
            e instanceof Error ? e.message : 'Could not load music.',
          );
          report(e);
        }
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [report],
  );
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Fetch account data when the external OAuth session connects.
    if (connected) void libraryRequest('recent', '', 'track', null);
  }, [connected, libraryRequest]);
  function browse(selected: LibraryMode, collection: Collection | null = null) {
    setMode(selected);
    setActiveCollection(collection);
    if (connected) void libraryRequest(selected, query, searchKind, collection);
    else setPanel('account');
  }
  function playSong(t: Track) {
    if (preview) {
      void runControl(() => preview.playTrack(t.uri));
      return;
    }
    if (!t.playable) {
      setError('This track is unavailable on your Spotify account.');
      return;
    }
    void runControl(async () => {
      setStatus('Preparing playback...');
      try {
        await playSelection(
          songContext
            ? { kind: 'context', uri: songContext, track: t }
            : {
                kind: 'tracks',
                items: songList,
                index: songList.indexOf(t),
                next: songContinuation,
              },
        );
      } finally {
        setStatus('');
      }
    });
  }
  function playCollection(collection: Collection) {
    if (collection.kind === 'show') {
      const first = songList.find((t) => t.playable);
      if (first) playSong(first);
      return;
    }
    void runControl(() =>
      playSelection({ kind: 'context', uri: collection.uri }),
    );
  }
  async function like(t: Track) {
    if (busy) return;
    setBusy(true);
    try {
      const wasSaved =
        saved.has(t.uri) ||
        list(
          await spotifyAPI(
            '/me/library/contains?uris=' + encodeURIComponent(t.uri),
          ),
        )[0] === true;
      await spotifyAPI(
        '/me/library?uris=' + encodeURIComponent(t.uri),
        wasSaved ? 'DELETE' : 'PUT',
      );
      setSaved((old) => {
        const value = new Set(old);
        if (wasSaved) value.delete(t.uri);
        else value.add(t.uri);
        return value;
      });
      setStatus(wasSaved ? 'Removed from Liked Songs' : 'Saved to Liked Songs');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function addQueue(t: Track) {
    if (!t.playable) return;
    if (await control('enqueue', { uri: t.uri }))
      setStatus('Added to Spotify queue');
  }
  async function showQueue() {
    if (preview) {
      setPanel('queue');
      return;
    }
    if (!connected) {
      setPanel('account');
      return;
    }
    setPanel('queue');
    setQueueLoading(true);
    setQueueError('');
    setQueueRevision((n) => n + 1);
  }
  async function showDevices() {
    if (!connected) {
      setPanel('account');
      return;
    }
    setPanel('devices');
    setLoading(true);
    try {
      setDevices(
        list(object(await spotifyAPI('/me/player/devices')).devices).flatMap(
          (v) => {
            const d = object(v);
            return isJsonString(d.id) && isJsonString(d.name)
              ? [{ id: d.id, name: d.name, active: d.is_active === true }]
              : [];
          },
        ),
      );
    } catch (e) {
      report(e);
    } finally {
      setLoading(false);
    }
  }
  async function makePlaylist() {
    if (!newPlaylist.trim() || busy) return;
    setBusy(true);
    try {
      const p = parseCollection(
        await spotifyAPI('/me/playlists', 'POST', {
          name: newPlaylist.trim(),
          public: false,
        }),
        'playlist',
      );
      if (p) {
        setPlaylists((old) => [p, ...old]);
        setNewPlaylist('');
        browse('collection', p);
        setStatus('Private playlist created');
      }
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function addTo(p: Collection) {
    if (!adding || busy) return;
    setBusy(true);
    try {
      await spotifyAPI(`/playlists/${p.id}/items`, 'POST', {
        uris: [adding.uri],
      });
      setStatus('Added to ' + p.name);
      setAdding(null);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="skin-stage" style={{ transform: `scale(${scale})` }}>
        <div className="left-ear drawer" style={{ left: leftOpen ? 0 : 207 }}>
          <Bitmap name="left_ear" />
          <Speakers side="left" frozen={vizSettings.frozen} />
          <Bitmap name="left_drawer_top" x={84} />
          <Bitmap name="left_drawer_bottom" x={84} y={150} />
          <Bitmap name="left_drawer_right" x={251} />
          <SkinButton
            label={leftOpen ? 'Close equalizer panel' : 'Open equalizer panel'}
            icon={leftOpen ? 'right' : 'left'}
            variant="ear"
            width={18}
            height={66}
            x={8}
            y={66}
            onClick={() => setLeftOpen(!leftOpen)}
          />
          {leftOpen && (
            <>
              <SkinButton
                label="Close equalizer panel"
                icon="close"
                variant="window"
                width={12}
                height={12}
                x={72}
                y={7}
                onClick={() => setLeftOpen(false)}
              />
              <div className="eq-interior">
                <Bitmap name="drawer_bkgrnd_left" />
                <Bitmap name="drawer_bkgrnd_top" x={10} />
                <Bitmap name="drawer_bkgrnd_bottom" x={10} y={137} />
                <Bitmap name="drawer_bkgrnd_right" x={166} />
                <label className="balance-label">
                  <input
                    className="old-slider"
                    type="range"
                    aria-label="Balance unavailable for Spotify audio"
                    min={-100}
                    max={100}
                    value={0}
                    disabled
                    title="Spotify does not expose audio balance"
                    readOnly
                  />
                  Balance
                </label>
                <label className="volume-label">
                  <input
                    className="old-slider"
                    type="range"
                    aria-label="Spotify volume"
                    min={0}
                    max={100}
                    value={volume ?? playback.volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    onPointerUp={() => {
                      if (volume !== null)
                        void control('volume', { value: volume }).finally(() =>
                          setVolume(null),
                        );
                    }}
                    onKeyUp={() => {
                      if (volume !== null)
                        void control('volume', { value: volume }).finally(() =>
                          setVolume(null),
                        );
                    }}
                  />
                  Volume
                </label>
                <div className="eq-ticks">
                  <span>+</span>
                  <span>0</span>
                  <span>−</span>
                </div>
                <div className="equalizer-bands">
                  {bands.map((value, i) => (
                    <label key={i}>
                      <span>•</span>
                      <input
                        className="eq-slider"
                        type="range"
                        min={-14}
                        max={14}
                        value={value}
                        aria-label={`Visualizer band ${i + 1}`}
                        title="Spectrum display gain. Spotify audio is unchanged."
                        onChange={(e) =>
                          setBands((old) =>
                            old.map((n, j) =>
                              j === i ? Number(e.target.value) : n,
                            ),
                          )
                        }
                      />
                      <span>•</span>
                    </label>
                  ))}
                </div>
                <button
                  className="eq-reset"
                  title="Reset visualization bands"
                  onClick={() => setBands(Array<number>(10).fill(0))}
                >
                  Reset
                </button>
                <select
                  className="eq-preset"
                  aria-label="Visualizer preset"
                  title="Visualizer presets adjust the spectrum display. Spotify audio is unchanged."
                  value={
                    BAND_PRESETS.find((preset) =>
                      preset.bands.every((value, i) => value === bands[i]),
                    )?.name ?? 'Custom'
                  }
                  onChange={(event) => {
                    const preset = BAND_PRESETS.find(
                      (preset) => preset.name === event.target.value,
                    );
                    if (preset) setBands([...preset.bands]);
                  }}
                >
                  <option value="Custom" disabled>
                    Custom
                  </option>
                  {BAND_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        <div
          className="right-ear drawer"
          style={{ left: rightOpen ? 488 : 277 }}
        >
          <Bitmap name="right_drawer_left" />
          <Bitmap name="right_drawer_top" x={13} />
          <Bitmap name="right_drawer_bottom" x={13} y={150} />
          <Bitmap name="right_ear" x={185} />
          <Speakers side="right" frozen={vizSettings.frozen} />
          <SkinButton
            label={rightOpen ? 'Close playlist' : 'Open playlist'}
            icon={rightOpen ? 'left' : 'right'}
            variant="ear"
            width={18}
            height={66}
            x={246}
            y={65}
            onClick={() => setRightOpen(!rightOpen)}
          />
          {rightOpen && (
            <>
              <SkinButton
                label="Close playlist"
                icon="close"
                variant="window"
                width={12}
                height={12}
                x={189}
                y={7}
                onClick={() => setRightOpen(false)}
              />
              <div className="playlist-interior">
                <select
                  aria-label="Playlist source"
                  disabled={Boolean(preview)}
                  value={mode === 'collection' ? activeCollection?.id : mode}
                  onChange={(e) => {
                    const p = playlists.find((p) => p.id === e.target.value);
                    if (p) browse('collection', p);
                    else if (
                      e.target.value === 'liked' ||
                      e.target.value === 'recent'
                    )
                      browse(e.target.value);
                    else {
                      setPanel('library');
                      browse('playlists');
                    }
                  }}
                >
                  <option value="recent">
                    {preview ? 'Demo queue' : 'Recently Played'}
                  </option>
                  {mode === 'search' && (
                    <option value="search">Search Results</option>
                  )}
                  {mode === 'collection' &&
                    activeCollection &&
                    !playlists.some((p) => p.id === activeCollection.id) && (
                      <option value={activeCollection.id}>
                        {activeCollection.name}
                      </option>
                    )}
                  <option value="liked">Liked Songs</option>
                  <option value="playlists">Music Library...</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="mini-track-list">
                  {preview ? (
                    <PreviewQueue
                      player={preview}
                      playback={playback}
                      busy={busy}
                      play={playSong}
                    />
                  ) : connected ? (
                    loading ? (
                      <p>Loading...</p>
                    ) : libraryError ? (
                      <div className="mini-connect">
                        <p role="alert">{libraryError}</p>
                        <button
                          onClick={() =>
                            void libraryRequest(
                              mode,
                              query,
                              searchKind,
                              activeCollection,
                            )
                          }
                        >
                          Retry
                        </button>
                        {activeCollection?.kind === 'playlist' && (
                          <button
                            disabled={busy}
                            onClick={() => playCollection(activeCollection)}
                          >
                            Play playlist
                          </button>
                        )}
                      </div>
                    ) : songList.length ? (
                      <PlaylistTracks
                        tracks={songList}
                        playback={playback}
                        busy={busy}
                        play={playSong}
                      />
                    ) : (
                      <button
                        className="mini-empty"
                        onClick={() => {
                          setPanel('library');
                          browse('playlists');
                        }}
                      >
                        Open music library
                      </button>
                    )
                  ) : (
                    <div className="mini-connect">
                      <p>Spotify</p>
                      <button onClick={() => setPanel('account')}>
                        Connect library
                      </button>
                      {playback.name && (
                        <p>
                          {playback.name}
                          <br />
                          {playback.artist}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="mini-toolbar">
                  <button
                    title="Search Spotify"
                    onClick={() => {
                      setPanel('library');
                      setMode('search');
                    }}
                  >
                    Search
                  </button>
                  <button
                    title="Spotify queue"
                    onClick={() => void showQueue()}
                  >
                    Queue
                  </button>
                  <button
                    title="Spotify devices"
                    onClick={() => void showDevices()}
                  >
                    Devices
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="head">
          <div className="screen">
            <Visualizer
              mode={viz}
              playing={playback.playing}
              bands={bands}
              settings={vizSettings}
            />
            {playback.uri && playback.name && (
              <SongCard key={playback.uri} playback={playback} />
            )}
          </div>
          <Bitmap name="head" className="head-bitmap" />
          <button
            className="drag-region"
            aria-label="Drag Headspace window"
            disabled={!window.headspaceNative}
            onPointerDown={() => void native('drag').catch(report)}
          />
          {(
            [
              { x: 1, name: 'Previous', method: 'previous', icon: 'previous' },
              {
                x: 26,
                name: playback.playing ? 'Pause' : 'Play',
                method: 'toggle',
                icon: playback.playing ? 'pause' : 'play',
              },
              { x: 52, name: 'Stop', method: 'stop', icon: 'stop' },
              { x: 77, name: 'Next', method: 'next', icon: 'next' },
              {
                x: 119,
                name: 'Choose visualization',
                method: 'visualizer',
                icon: 'visualizer',
              },
            ] satisfies {
              x: number;
              name: string;
              method: string;
              icon: SkinIcon;
            }[]
          ).map((c) => (
            <SkinButton
              key={c.method}
              label={c.name}
              icon={c.icon}
              variant={c.method === 'visualizer' ? 'gold' : 'transport'}
              x={48 + c.x}
              y={32}
              width={23}
              height={23}
              disabled={busy && c.method !== 'visualizer'}
              onClick={() =>
                c.method === 'visualizer'
                  ? setVizOpen(!vizOpen)
                  : void control(c.method)
              }
            />
          ))}
          <SkinButton
            label="Minimize"
            disabled={!window.headspaceNative}
            icon="minimize"
            variant="window"
            x={101}
            y={4}
            width={14}
            height={16}
            onClick={() => void native('minimize').catch(report)}
          />
          <SkinButton
            label="Close Headspace"
            disabled={!window.headspaceNative}
            icon="close"
            variant="window"
            x={116}
            y={4}
            width={14}
            height={16}
            onClick={() => void native('close').catch(report)}
          />
          <SkinButton
            label={playback.shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
            icon="shuffle"
            pressed={playback.shuffle}
            disabled={busy}
            variant="utility"
            width={20}
            height={19}
            x={15}
            y={214}
            onClick={() => void control('shuffle')}
          />
          <SkinButton
            label={`Repeat: ${playback.repeat === 'track' ? 'one' : playback.repeat === 'context' ? 'all' : 'off'}`}
            icon={playback.repeat === 'track' ? 'repeatOne' : 'repeat'}
            pressed={playback.repeat !== 'off'}
            disabled={busy}
            variant="utility"
            width={19}
            height={20}
            x={204}
            y={214}
            onClick={() => void control('repeat')}
          />
          <input
            className="seek-slider"
            aria-label="Seek"
            title={`${playback.name || 'Spotify'} ${formatTime(seek ?? playback.position)} / ${formatTime(playback.duration)}`}
            style={{ left: 39, top: 223 }}
            type="range"
            min={0}
            max={playback.duration || 1}
            step={1000}
            value={seek ?? playback.position}
            disabled={!playback.uri}
            onChange={(e) => setSeek(Number(e.target.value))}
            onPointerUp={() => {
              if (seek !== null)
                void control('seek', { value: seek / 1000 }).finally(() =>
                  setSeek(null),
                );
            }}
            onKeyUp={() => {
              if (seek !== null)
                void control('seek', { value: seek / 1000 }).finally(() =>
                  setSeek(null),
                );
            }}
          />
          <SkinButton
            label="Open full music library"
            icon="library"
            variant="utility"
            width={35}
            height={31}
            x={101}
            y={232}
            onClick={() => setPanel('library')}
          />
          {vizOpen && (
            <fieldset
              className="visualization-chooser"
              aria-label="Visualization settings"
            >
              <div className="viz-heading">
                <span>Visualization</span>
                <button
                  aria-label="Close visualization chooser"
                  onClick={() => setVizOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="viz-modes">
                {visualizations.map((name, index) => (
                  <button
                    key={name}
                    aria-pressed={viz === index}
                    onClick={() => setViz(index)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="viz-adjustments">
                <label>
                  Speed
                  <input
                    aria-label="Visualization speed"
                    type="range"
                    min="0.25"
                    max="2"
                    step="0.05"
                    value={vizSettings.speed}
                    onChange={(e) =>
                      setVizSettings((s) => ({
                        ...s,
                        speed: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Glow
                  <input
                    aria-label="Visualization glow"
                    type="range"
                    min="0.4"
                    max="2"
                    step="0.05"
                    value={vizSettings.glow}
                    onChange={(e) =>
                      setVizSettings((s) => ({
                        ...s,
                        glow: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Color
                  <input
                    aria-label="Visualization color"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={vizSettings.hue}
                    onChange={(e) =>
                      setVizSettings((s) => ({
                        ...s,
                        hue: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="viz-footer">
                <button
                  aria-pressed={vizSettings.frozen}
                  onClick={() =>
                    setVizSettings((s) => ({ ...s, frozen: !s.frozen }))
                  }
                >
                  {vizSettings.frozen ? 'Resume motion' : 'Freeze motion'}
                </button>
                <button
                  onClick={() => setVizSettings(defaultVisualizerSettings)}
                >
                  Reset
                </button>
              </div>
              {preview ? (
                <p className="audio-response">
                  Visuals and speakers react to the preview audio.
                </p>
              ) : (
                <div
                  className="audio-response"
                  data-audio-state={audioStatus.state}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={audioEnabled}
                      onChange={(event) =>
                        setAudioEnabled(event.target.checked)
                      }
                    />
                    React to Mac audio
                    <span className="audio-status-light" />
                  </label>
                  <output>{audioStatus.message}</output>
                  {audioEnabled &&
                    (audioStatus.state === 'denied' ||
                      audioStatus.state === 'unavailable') && (
                      <button
                        onClick={() => setAudioAttempt((value) => value + 1)}
                      >
                        Retry audio connection
                      </button>
                    )}
                </div>
              )}
            </fieldset>
          )}
        </div>
      </div>
      {(error || status) && (
        <div className={`status-message ${error ? 'error' : ''}`} role="alert">
          <span>{error || status}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError('');
              setStatus('');
            }}
          >
            ×
          </button>
        </div>
      )}
      {panel && (
        <Modal
          title={
            panel === 'library'
              ? 'Headspace — Music Library'
              : panel === 'account'
                ? 'Spotify Connection'
                : panel === 'queue'
                  ? 'Spotify Queue'
                  : panel === 'devices'
                    ? 'Playback Devices'
                    : 'About Headspace'
          }
          close={() => setPanel(null)}
        >
          {panel === 'account' && (
            <div className="account-content">
              <h2>
                {connected
                  ? `Connected as ${profile}`
                  : 'Connect your Spotify library'}
              </h2>
              <p>
                {connected
                  ? 'Your music and playlists are available in Headspace.'
                  : 'Connect your Premium account to stream music directly in Headspace.'}
              </p>
              <p>Audio plays inside Headspace. Spotify Premium required.</p>
              <div className="classic-actions">
                {connected ? (
                  <button
                    onClick={() => {
                      disconnectPlayer();
                      disconnect();
                      if (window.headspaceNative)
                        void native('clearSession').catch(report);
                      setConnected(false);
                      setSongList([]);
                      setCollectionList([]);
                      setProfile('');
                      setPanel(null);
                    }}
                  >
                    Disconnect account
                  </button>
                ) : (
                  <button disabled={authBusy} onClick={() => void signIn()}>
                    {authBusy ? 'Connecting...' : 'Connect Spotify'}
                  </button>
                )}
                <button onClick={() => void control('reconnect')}>
                  Retry playback connection
                </button>
                <button disabled={authBusy} onClick={() => void signIn()}>
                  Reconnect Spotify
                </button>
              </div>
              {authURL && (
                <details open>
                  <summary>Use another browser</summary>
                  <p>
                    Open this sign-in link in a browser where you are logged
                    into Spotify.
                  </p>
                  <input
                    className="auth-url"
                    aria-label="Spotify sign-in URL"
                    readOnly
                    value={authURL}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </details>
              )}
              <small>
                Your sign-in is saved securely in your Mac Keychain.
              </small>
            </div>
          )}
          {panel === 'library' && (
            <div className="library-content">
              <div className="classic-tabs">
                {(
                  [
                    'playlists',
                    'albums',
                    'artists',
                    'shows',
                    'liked',
                    'recent',
                  ] satisfies LibraryMode[]
                ).map((m) => (
                  <button
                    className={mode === m ? 'active' : ''}
                    key={m}
                    onClick={() => browse(m)}
                  >
                    {m === 'liked'
                      ? 'Liked Songs'
                      : m === 'shows'
                        ? 'Podcasts'
                        : m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
                <button onClick={() => setPanel('account')}>
                  {connected ? profile || 'Account' : 'Connect Spotify'}
                </button>
              </div>
              <form
                className="classic-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setMode('search');
                  setActiveCollection(null);
                  if (!connected) setPanel('account');
                  else void libraryRequest('search', query, searchKind, null);
                }}
              >
                <label htmlFor="spotify-search">Search</label>
                <input
                  id="spotify-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Song, artist, album..."
                />
                <select
                  aria-label="Search type"
                  value={searchKind}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === 'track' ||
                      value === 'album' ||
                      value === 'artist' ||
                      value === 'playlist' ||
                      value === 'show'
                    )
                      setSearchKind(value);
                  }}
                >
                  <option value="track">Songs</option>
                  <option value="album">Albums</option>
                  <option value="artist">Artists</option>
                  <option value="playlist">Playlists</option>
                  <option value="show">Podcasts</option>
                </select>
                <button type="submit" disabled={!query.trim() || loading}>
                  Go
                </button>
              </form>
              {activeCollection && mode === 'collection' && (
                <div className="collection-caption">
                  <strong>{activeCollection.name}</strong>
                  <button
                    disabled={busy}
                    onClick={() => playCollection(activeCollection)}
                  >
                    ► Play
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void spotifyAPI(
                        '/me/library?uris=' +
                          encodeURIComponent(activeCollection.uri),
                        'PUT',
                      )
                        .then(() => setStatus('Saved to Spotify library'))
                        .catch(report)
                        .finally(() => setBusy(false));
                    }}
                  >
                    Save
                  </button>
                  <a href={activeCollection.url}>Open in Spotify ↗</a>
                </div>
              )}
              <div className="library-results">
                {loading && !songList.length && !collectionList.length ? (
                  <p className="library-empty">Loading Spotify...</p>
                ) : !connected ? (
                  <button
                    className="library-empty"
                    onClick={() => setPanel('account')}
                  >
                    Connect Spotify to browse your music.
                  </button>
                ) : !songList.length && !collectionList.length ? (
                  <p className="library-empty">
                    {mode === 'search'
                      ? 'Enter a search above.'
                      : 'No available items. Choose another collection.'}
                  </p>
                ) : null}
                {
                  <TrackRows
                    items={songList}
                    currentURI={playback.uri}
                    playing={playback.playing}
                    busy={busy}
                    saved={saved}
                    playSong={playSong}
                    like={like}
                    addQueue={addQueue}
                    setAdding={setAdding}
                  />
                }
                <CollectionRows
                  items={collectionList}
                  open={(c) => browse('collection', c)}
                />
              </div>
              <div className="library-bottom">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void makePlaylist();
                  }}
                >
                  <input
                    aria-label="New playlist name"
                    placeholder="New playlist name"
                    value={newPlaylist}
                    onChange={(e) => setNewPlaylist(e.target.value)}
                  />
                  <button disabled={!connected || !newPlaylist.trim() || busy}>
                    Create
                  </button>
                </form>
                {next && (
                  <button
                    disabled={loading}
                    onClick={() =>
                      void libraryRequest(
                        mode,
                        query,
                        searchKind,
                        activeCollection,
                        next,
                      )
                    }
                  >
                    More
                  </button>
                )}
                <button
                  disabled={busy}
                  aria-pressed={playback.shuffle}
                  onClick={() => void control('shuffle')}
                >
                  {playback.shuffle ? '✓ ' : ''}Shuffle
                </button>
                <button disabled={busy} onClick={() => void control('repeat')}>
                  Repeat:{' '}
                  {playback.repeat === 'context'
                    ? 'all'
                    : playback.repeat === 'track'
                      ? 'one'
                      : 'off'}
                </button>
                <button onClick={() => void showQueue()}>Queue</button>
                <button onClick={() => void showDevices()}>Devices</button>
              </div>
            </div>
          )}
          {panel === 'queue' && preview && (
            <PreviewQueue
              player={preview}
              playback={playback}
              busy={busy}
              play={playSong}
            />
          )}
          {panel === 'queue' && !preview && (
            <div className="queue-content">
              <div className="queue-controls">
                <button
                  disabled={busy}
                  aria-pressed={playback.shuffle}
                  onClick={() => void control('shuffle')}
                >
                  Shuffle {playback.shuffle ? 'on' : 'off'}
                </button>
                <button disabled={busy} onClick={() => void control('repeat')}>
                  Repeat:{' '}
                  {playback.repeat === 'context'
                    ? 'all'
                    : playback.repeat === 'track'
                      ? 'one'
                      : 'off'}
                </button>
                <button onClick={() => void showQueue()}>Refresh</button>
                <a href="https://open.spotify.com/queue">Edit in Spotify ↗</a>
              </div>
              {queueLoading ? (
                <p>Loading queue...</p>
              ) : queueError ? (
                <p role="alert">{queueError}</p>
              ) : (
                <>
                  <p>
                    <strong>Now playing</strong>
                    <br />
                    {queueCurrent
                      ? `${queueCurrent.name} · ${queueCurrent.artist}`
                      : 'Nothing playing'}
                  </p>
                  <strong>Next up</strong>
                  {queue.length ? (
                    <QueueRows items={queue} />
                  ) : (
                    <p>
                      No upcoming songs. Play an album, playlist, or song list
                      to keep listening.
                    </p>
                  )}
                </>
              )}
              <p className="queue-help">
                Queued songs play before the rest of your music. For similar
                songs after it ends, enable Autoplay in Spotify settings.
              </p>
            </div>
          )}
          {panel === 'devices' && (
            <div className="devices-content">
              <p>
                Transport buttons control Headspace’s built-in player. You can
                also transfer your Spotify session to a device below.
              </p>
              {devices.map((d) => (
                <button
                  key={d.id}
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void spotifyAPI('/me/player', 'PUT', {
                      device_ids: [d.id],
                      play: playback.playing,
                    })
                      .then(() => showDevices())
                      .catch(report)
                      .finally(() => setBusy(false));
                  }}
                >
                  {d.active ? '●' : '○'} {d.name}
                </button>
              ))}
              <button onClick={() => void showDevices()}>Refresh</button>
            </div>
          )}
          {panel === 'about' && (
            <p>
              Original Headspace skin © 2000 Microsoft Corporation. Personal
              local adaptation.
            </p>
          )}
        </Modal>
      )}
      {adding && (
        <Modal
          title={`Add ${adding.name} to playlist`}
          close={() => setAdding(null)}
        >
          <div className="playlist-picker">
            <PlaylistPicker
              items={playlists}
              busy={busy}
              choose={(p) => void addTo(p)}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
