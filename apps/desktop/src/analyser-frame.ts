import type { AudioFrame } from './audio-frame.ts';

export function analyseSamples(
  frequencies: Uint8Array,
  samples: Float32Array,
  sampleRate: number,
): AudioFrame {
  const binWidth = sampleRate / (frequencies.length * 2);
  function energy(low: number, high: number) {
    const start = Math.max(1, Math.floor(low / binWidth));
    const end = Math.min(frequencies.length, Math.ceil(high / binWidth));
    let total = 0;
    for (let i = start; i < end; i++) total += (frequencies[i] / 255) ** 2;
    return Math.sqrt(total / Math.max(1, end - start));
  }
  let sum = 0;
  let peak = 0;
  for (const sample of samples) {
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return {
    spectrum: Array.from({ length: 64 }, (_, i) =>
      energy(
        30 * (16000 / 30) ** (i / 64),
        30 * (16000 / 30) ** ((i + 1) / 64),
      ),
    ),
    waveform: Array.from({ length: 128 }, (_, i) =>
      Math.max(
        -1,
        Math.min(1, samples[Math.floor((i * samples.length) / 128)] ?? 0),
      ),
    ),
    bass: energy(30, 250),
    mid: energy(250, 4000),
    treble: energy(4000, 16000),
    rms: Math.min(1, Math.sqrt(sum / Math.max(1, samples.length))),
    peak: Math.min(1, peak),
  };
}
