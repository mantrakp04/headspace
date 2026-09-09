import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseSamples } from './analyser-frame.ts';
import { parseAudioFrame, silentAudioFrame } from './audio-frame.ts';

void test('browser silence produces a silent frame for both visuals and speakers', () => {
  assert.deepEqual(
    analyseSamples(new Uint8Array(1024), new Float32Array(2048), 48000),
    silentAudioFrame,
  );
});

void test('the spectrum responds to bass and treble independently and waveform energy comes from samples', () => {
  const frequencies = new Uint8Array(1024);
  frequencies[4] = 255;
  const samples = Float32Array.from(
    { length: 2048 },
    (_, i) => 0.5 * Math.sin((i * Math.PI) / 32),
  );
  const bass = analyseSamples(frequencies, samples, 48000);
  assert.ok(bass.bass > 0);
  assert.equal(bass.treble, 0);
  assert.ok(Math.abs(bass.rms - Math.sqrt(0.125)) < 0.001);
  assert.equal(bass.peak, 0.5);
  assert.ok(bass.waveform.some((value) => value < 0));
  assert.ok(parseAudioFrame(bass));
  frequencies.fill(0);
  frequencies[300] = 255;
  const treble = analyseSamples(frequencies, samples, 48000);
  assert.equal(treble.bass, 0);
  assert.ok(treble.treble > 0);
  assert.notDeepEqual(treble.spectrum, bass.spectrum);
});
