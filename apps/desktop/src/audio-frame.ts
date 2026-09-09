export type AudioFrame = {
  spectrum: number[];
  waveform: number[];
  bass: number;
  mid: number;
  treble: number;
  rms: number;
  peak: number;
};

export const silentAudioFrame: AudioFrame = {
  spectrum: Array<number>(64).fill(0),
  waveform: Array<number>(128).fill(0),
  bass: 0,
  mid: 0,
  treble: 0,
  rms: 0,
  peak: 0,
};

function samples(
  value: unknown,
  length: number,
  minimum: number,
): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(
      (sample: unknown) =>
        typeof sample === 'number' &&
        Number.isFinite(sample) &&
        sample >= minimum &&
        sample <= 1,
    )
  );
}

function level(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

export function parseAudioFrame(value: unknown): AudioFrame | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('spectrum' in value) ||
    !samples(value.spectrum, 64, 0) ||
    !('waveform' in value) ||
    !samples(value.waveform, 128, -1) ||
    !('bass' in value) ||
    !level(value.bass) ||
    !('mid' in value) ||
    !level(value.mid) ||
    !('treble' in value) ||
    !level(value.treble) ||
    !('rms' in value) ||
    !level(value.rms) ||
    !('peak' in value) ||
    !level(value.peak)
  )
    return null;
  return {
    spectrum: value.spectrum,
    waveform: value.waveform,
    bass: value.bass,
    mid: value.mid,
    treble: value.treble,
    rms: value.rms,
    peak: value.peak,
  };
}

export function decayAudioFrame(frame: AudioFrame, age: number): AudioFrame {
  if (age <= 100) return frame;
  if (age >= 600) return silentAudioFrame;
  const gain = Math.exp(-(age - 100) / 85);
  return {
    spectrum: frame.spectrum.map((v) => v * gain),
    waveform: frame.waveform.map((v) => v * gain),
    bass: frame.bass * gain,
    mid: frame.mid * gain,
    treble: frame.treble * gain,
    rms: frame.rms * gain,
    peak: frame.peak * gain,
  };
}
