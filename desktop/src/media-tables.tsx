/* oxlint-disable nextjs/no-img-element -- Native app uses Spotify album artwork directly. */
import { useMemo } from 'react';
import { formatTime, type Collection, type Track } from '../../lib/spotify';
import { VirtualTable, type MediaColumn } from './virtual-table';

export function TrackRows({
  items,
  compact = false,
  currentURI,
  playing,
  busy,
  saved,
  playSong,
  like,
  addQueue,
  setAdding,
}: {
  items: Track[];
  compact?: boolean;
  currentURI: string;
  playing: boolean;
  busy: boolean;
  saved: Set<string>;
  playSong: (t: Track) => void;
  like: (t: Track) => Promise<void>;
  addQueue: (t: Track) => Promise<void>;
  setAdding: (t: Track) => void;
}) {
  // Spotify identifies the track, not a history occurrence. Mark one representative row.
  const currentIndex = useMemo(
    () => items.findIndex((track) => track.uri === currentURI),
    [items, currentURI],
  );
  const columns = useMemo<MediaColumn<Track>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Title',
        cell: ({ row }) => {
          const t = row.original;
          return (
            <button
              className="song-name"
              onClick={() => playSong(t)}
              disabled={!t.playable || busy}
              title={`${t.name} • ${t.artist}`}
            >
              <span className="song-icon">
                {row.index === currentIndex && playing ? '►' : '♫'}
              </span>
              {t.name}
            </button>
          );
        },
      },
      {
        id: 'duration',
        accessorKey: 'duration',
        header: 'Time',
        cell: ({ row }) => formatTime(row.original.duration),
      },
      ...(!compact
        ? [
            {
              id: 'artist',
              accessorKey: 'artist',
              header: 'Artist',
              cell: ({ row }) => (
                <span title={row.original.artist}>{row.original.artist}</span>
              ),
            } satisfies MediaColumn<Track>,
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => {
                const t = row.original;
                return (
                  <div className="track-actions">
                    <button
                      aria-label={
                        saved.has(t.uri) ? `Unlike ${t.name}` : `Like ${t.name}`
                      }
                      title={
                        saved.has(t.uri)
                          ? 'Remove from Liked Songs'
                          : 'Save to Liked Songs'
                      }
                      disabled={busy}
                      onClick={() => void like(t)}
                    >
                      {saved.has(t.uri) ? '♥' : '♡'}
                    </button>
                    <button
                      aria-label={`Queue ${t.name}`}
                      title="Add to queue"
                      disabled={busy || !t.playable}
                      onClick={() => void addQueue(t)}
                    >
                      Q+
                    </button>
                    <button
                      aria-label={`Add ${t.name} to playlist`}
                      title="Add to playlist"
                      disabled={busy}
                      onClick={() => setAdding(t)}
                    >
                      +
                    </button>
                    <a href={t.url} title="Open in Spotify">
                      ↗
                    </a>
                  </div>
                );
              },
            } satisfies MediaColumn<Track>,
          ]
        : []),
    ],
    [
      compact,
      currentIndex,
      playing,
      busy,
      saved,
      playSong,
      like,
      addQueue,
      setAdding,
    ],
  );
  return (
    <VirtualTable
      items={items}
      columns={columns}
      currentIndex={currentIndex}
      rowHeight={compact ? 11 : 29}
      className={compact ? 'compact-tracks' : 'full-tracks'}
      grid={compact ? 'minmax(0,1fr) 24px' : 'minmax(0,1fr) 38px 120px 106px'}
      label={compact ? 'Playlist tracks' : 'Music tracks'}
    />
  );
}
export function CollectionRows({
  items,
  open,
}: {
  items: Collection[];
  open: (c: Collection) => void;
}) {
  const columns = useMemo<MediaColumn<Collection>[]>(
    () => [
      {
        id: 'cover',
        header: 'Artwork',
        cell: ({ row }) =>
          row.original.image ? (
            <img
              src={row.original.image}
              alt=""
              width={34}
              height={34}
              loading="lazy"
            />
          ) : null,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            className="song-name"
            onClick={() => open(row.original)}
            title={row.original.name}
          >
            {row.original.name}
          </button>
        ),
      },
      {
        id: 'subtitle',
        accessorKey: 'subtitle',
        header: 'Artist',
        cell: ({ row }) => row.original.subtitle,
      },
    ],
    [open],
  );
  return (
    <VirtualTable
      items={items}
      columns={columns}
      rowHeight={44}
      grid="38px minmax(0,1fr) minmax(80px,.7fr)"
      className="collection-table"
      label="Music collections"
    />
  );
}
const queueColumns: MediaColumn<Track>[] = [
  { id: 'number', header: '#', cell: ({ row }) => row.getDisplayIndex() + 1 },
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Title',
    cell: ({ row }) => row.original.name,
  },
  {
    id: 'artist',
    accessorKey: 'artist',
    header: 'Artist',
    cell: ({ row }) => row.original.artist,
  },
  {
    id: 'duration',
    accessorKey: 'duration',
    header: 'Time',
    cell: ({ row }) => formatTime(row.original.duration),
  },
];
export function QueueRows({ items }: { items: Track[] }) {
  return (
    <VirtualTable
      items={items}
      columns={queueColumns}
      rowHeight={30}
      grid="30px minmax(0,1fr) 150px 38px"
      label="Spotify queue"
    />
  );
}
export function PlaylistPicker({
  items,
  choose,
  busy,
}: {
  items: Collection[];
  choose: (p: Collection) => void;
  busy: boolean;
}) {
  const columns = useMemo<MediaColumn<Collection>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Playlist',
        cell: ({ row }) => (
          <button disabled={busy} onClick={() => choose(row.original)}>
            {row.original.name}
          </button>
        ),
      },
    ],
    [choose, busy],
  );
  return (
    <VirtualTable
      items={items}
      columns={columns}
      rowHeight={30}
      grid="minmax(0,1fr)"
      label="Choose playlist"
    />
  );
}
