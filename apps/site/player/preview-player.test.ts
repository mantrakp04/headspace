import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createPreviewPlayer } from './preview-player.ts';
import { readAudioFrame } from '../../desktop/src/audio.ts';
import { silentAudioFrame } from '../../desktop/src/audio-frame.ts';

class AudioFixture extends EventTarget {
  static current: AudioFixture;
  static blockNextPlay = false;
  constructor() {
    super();
    AudioFixture.current = this;
  }
  src = '';
  paused = true;
  ended = false;
  currentTime = 0;
  duration = NaN;
  error = null;
  async play() {
    if (AudioFixture.blockNextPlay) {
      AudioFixture.blockNextPlay = false;
      throw new DOMException('User activation required', 'NotAllowedError');
    }
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('playing'));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  load() {}
  removeAttribute() {
    this.src = '';
  }
}

class NodeFixture {
  gain = { value: 1 };
  frequencyBinCount = 1024;
  fftSize = 2048;
  connect(node: NodeFixture) {
    return node;
  }
  disconnect() {}
  getByteFrequencyData(values: Uint8Array) {
    values.fill(128);
  }
  getFloatTimeDomainData(values: Float32Array) {
    values.fill(0.25);
  }
}

class ContextFixture {
  static current: ContextFixture;
  constructor() {
    ContextFixture.current = this;
  }
  state = 'suspended';
  sampleRate = 48000;
  destination = new NodeFixture();
  createMediaElementSource() {
    return new NodeFixture();
  }
  createGain() {
    return new NodeFixture();
  }
  createAnalyser() {
    return new NodeFixture();
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }
}

void test('preview transport plays the default queue, seeks, mutes visuals, advances and cleans up', async () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const windowFixture = Object.assign(new EventTarget(), {
    parent: new EventTarget(),
  });
  for (const [key, value] of Object.entries({
    window: windowFixture,
    Audio: AudioFixture,
    AudioContext: ContextFixture,
    Element: class {},
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const player = createPreviewPlayer();
  let dispose = player.mount();
  try {
    assert.equal(player.readPlayback().name, 'Break Free');
    assert.equal(player.readPlayback().playing, true);
    await player.command('pause');
    await player.command('toggle');
    assert.equal(player.readPlayback().playing, true);
    assert.ok(readAudioFrame().rms > 0);
    await player.command('seek', { value: 8 });
    assert.equal(player.readPlayback().position, 8000);
    await player.command('pause');
    assert.equal(player.readPlayback().position, 8000);
    assert.deepEqual(readAudioFrame(), silentAudioFrame);
    await player.command('play');
    await player.command('volume', { value: 0 });
    assert.equal(player.readPlayback().volume, 0);
    assert.deepEqual(readAudioFrame(), silentAudioFrame);
    await player.command('volume', { value: 50 });
    await player.command('next');
    assert.equal(player.readPlayback().uri, player.tracks[1].uri);
    AudioFixture.current.dispatchEvent(new Event('ended'));
    await Promise.resolve();
    assert.equal(player.readPlayback().uri, player.tracks[2].uri);
    AudioFixture.current.ended = true;
    AudioFixture.current.dispatchEvent(new Event('ended'));
    assert.equal(player.readPlayback().uri, player.tracks[2].uri);
    assert.equal(player.readPlayback().playing, false);
    await player.command('previous');
    assert.equal(player.readPlayback().uri, player.tracks[1].uri);
    await player.playTrack(player.tracks[0].uri);
    assert.equal(player.readPlayback().name, 'Break Free');
    await player.command('stop');
    assert.equal(player.readPlayback().position, 0);
    assert.equal(player.readPlayback().playing, false);
    await assert.rejects(player.command('seek', { value: NaN }), /Invalid/);
    await assert.rejects(
      player.playTrack('spotify:track:missing'),
      /not in the demo queue/,
    );
    dispose();
    assert.equal(ContextFixture.current.state, 'closed');
    assert.deepEqual(readAudioFrame(), silentAudioFrame);
    AudioFixture.blockNextPlay = true;
    dispose = player.mount();
    await setImmediate();
    assert.equal(player.readPlayback().playing, false);
    windowFixture.parent.dispatchEvent(new Event('pointerdown'));
    await setImmediate();
    assert.equal(player.readPlayback().playing, true);
  } finally {
    dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
