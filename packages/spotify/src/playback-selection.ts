import {
  object,
  pagePath,
  tracks,
  type JsonValue,
  type Playback,
  type Track,
} from './spotify.ts';

export type PlaybackSelection =
  | { kind: 'context'; uri: string; track?: Track }
  | {
      kind: 'tracks';
      items: readonly Track[];
      index: number;
      next: string | null;
    };

export type PlaybackBody =
  | {
      context_uri: string;
      offset?: { position: number } | { uri: string };
      position_ms: number;
    }
  | { uris: string[]; offset: { position: number }; position_ms: number };

export async function resolvePlayback(
  selection: PlaybackSelection,
  request: (path: string) => Promise<JsonValue>,
): Promise<PlaybackBody> {
  if (selection.kind === 'context') {
    if (!/^spotify:(album|playlist|artist):[a-zA-Z0-9]+$/.test(selection.uri))
      throw new Error('This collection cannot be played as a Spotify context.');
    const track = selection.track;
    if (track && !track.playable) throw new Error('This track is unavailable.');
    if (track && selection.uri.startsWith('spotify:artist:'))
      throw new Error('Choose an album to start at a specific song.');
    if (!track) {
      return {
        context_uri: selection.uri,
        position_ms: 0,
      };
    }
    return {
      context_uri: selection.uri,
      offset:
        track.contextPosition === undefined
          ? { uri: track.uri }
          : { position: track.contextPosition },
      position_ms: 0,
    };
  }

  const selected = selection.items[selection.index];
  if (!selected?.playable) throw new Error('This track is unavailable.');
  const items = [...selection.items];
  let next = selection.next;
  const visited = new Set<string>();
  while (next) {
    if (visited.has(next))
      throw new Error('Spotify returned a repeated page. Retry playback.');
    visited.add(next);
    const raw = object(await request(next));
    const page = 'items' in raw ? raw : object(raw.tracks ?? raw.episodes);
    items.push(...tracks(page.items));
    next = pagePath(page.next);
  }
  return {
    uris: items.filter((t) => t.playable).map((t) => t.uri),
    offset: {
      position: items.slice(0, selection.index).filter((t) => t.playable)
        .length,
    },
    position_ms: 0,
  };
}

export function nextRepeat(mode: Playback['repeat']): Playback['repeat'] {
  return mode === 'off' ? 'context' : mode === 'context' ? 'track' : 'off';
}

export function sdkRepeat(mode: JsonValue | undefined): Playback['repeat'] {
  return mode === 1 ? 'context' : mode === 2 ? 'track' : 'off';
}
