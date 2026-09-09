import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decayAudioFrame,
  parseAudioFrame,
  silentAudioFrame,
} from './audio-frame.ts';

void test('capture boundary rejects malformed, nonfinite, and out-of-range samples', () => {
  assert.deepEqual(parseAudioFrame(silentAudioFrame), silentAudioFrame);
  for (const patch of [
    { bass: NaN },
    { rms: 1.1 },
    { treble: -0.1 },
    { spectrum: [0] },
    { waveform: Array(128).fill(Infinity) },
  ])
    assert.equal(parseAudioFrame({ ...silentAudioFrame, ...patch }), null);
  assert.equal(parseAudioFrame(null), null);
});

void test('a stalled native stream releases to silence instead of holding the last beat', () => {
  const loud = {
    ...silentAudioFrame,
    bass: 1,
    rms: 0.8,
    spectrum: Array<number>(64).fill(0.5),
  };
  assert.equal(decayAudioFrame(loud, 50), loud);
  const tail = decayAudioFrame(loud, 270);
  assert.ok(tail.bass > 0 && tail.bass < 0.15);
  assert.ok(tail.spectrum[0] < loud.spectrum[0]);
  assert.equal(decayAudioFrame(loud, 600), silentAudioFrame);
  assert.equal(decayAudioFrame(loud, Infinity), silentAudioFrame);
});
