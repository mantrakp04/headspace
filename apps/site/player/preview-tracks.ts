import type { Track } from '@headspace/spotify';

// Public preview clips verified against each Spotify track's embed page.
export const previewTracks = [
  {
    id: '1X2Zd5wKGbY1oKzb8dzJRy',
    name: 'Break Free',
    artist: 'Ariana Grande, Zedd',
    album: 'My Everything',
    duration: 29_713,
    image:
      'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021254a60895a75d37796045c8',
    previewURL:
      'https://p.scdn.co/mp3-preview/86e074aa8cf7cb9930b5c28415dc7b3a56e5d3ce',
  },
  {
    id: '7rXke3ttpL2uXel9Nesf4u',
    name: 'Sweet Disposition - John Summit & Silver Panda Remix',
    artist: 'The Temper Trap, John Summit, Silver Panda',
    album: 'Sweet Disposition (John Summit & Silver Panda Remix)',
    duration: 15_239,
    image:
      'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0278ae388833cd7d0ef2df63ef',
    previewURL:
      'https://p.scdn.co/mp3-preview/56cdf6c9a510b9c8acf702e3960195c28e1db92d',
  },
  {
    id: '03p9MCjq5ld1kRmqCGNXgs',
    name: 'EVERYTHING IN ITS RIGHT PLACE',
    artist: 'JEWELS, YUMA, SOMMA, MAGNUS, LE YORA',
    album: 'EVERYTHING IN ITS RIGHT PLACE',
    duration: 15_480,
    image:
      'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020e3f20d3d1aa8bc551cf271a',
    previewURL:
      'https://p.scdn.co/mp3-preview/a883eebc05a358012ee3f0e292096b9f576cf364',
  },
].map(
  (track) =>
    ({
      ...track,
      uri: `spotify:track:${track.id}`,
      url: `https://open.spotify.com/track/${track.id}`,
      playable: true,
    }) satisfies Track & { previewURL: string },
);
