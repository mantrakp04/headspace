import { useEffect, useSyncExternalStore } from 'react';
import { native } from './bridge.ts';
import {
  decayAudioFrame,
  parseAudioFrame,
  silentAudioFrame,
} from './audio-frame.ts';
export type { AudioFrame } from './audio-frame';
import type { AudioFrame } from './audio-frame';

type CaptureStatus = {
  state: 'idle' | 'starting' | 'running' | 'denied' | 'unavailable';
  message: string;
};
let latest = silentAudioFrame;
let receivedAt = -Infinity;
let previewSource: (() => AudioFrame) | null = null;

export function setPreviewAudioSource(source: (() => AudioFrame) | null) {
  previewSource = source;
}

export function readAudioFrame(now = performance.now()) {
  if (previewSource) return previewSource();
  return decayAudioFrame(latest, now - receivedAt);
}

function parseStatus(value: unknown): CaptureStatus | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('state' in value) ||
    !('message' in value) ||
    typeof value.message !== 'string'
  )
    return null;
  const { state, message } = value;
  if (
    state === 'idle' ||
    state === 'starting' ||
    state === 'running' ||
    state === 'denied' ||
    state === 'unavailable'
  )
    return { state, message };
  return null;
}

let captureStatus: CaptureStatus = {
  state: 'idle',
  message: 'Audio response is off.',
};
const listeners = new Set<() => void>();
function publishStatus(status: CaptureStatus) {
  captureStatus = status;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  return captureStatus;
}

export function useAudioCapture(enabled: boolean, attempt: number) {
  const status = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    let disposed = false;
    latest = silentAudioFrame;
    receivedAt = -Infinity;
    function audio(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const frame = parseAudioFrame(event.detail);
      if (frame) {
        latest = frame;
        receivedAt = performance.now();
      }
    }
    function changed(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const next = parseStatus(event.detail);
      if (!next) return;
      publishStatus(next);
      if (next.state !== 'running') {
        latest = silentAudioFrame;
        receivedAt = -Infinity;
      }
    }
    if (!enabled) {
      publishStatus({ state: 'idle', message: 'Audio response is off.' });
      return;
    }
    if (!window.headspaceNative) {
      publishStatus({
        state: 'unavailable',
        message: 'Open Headspace.app for audio response.',
      });
      return;
    }
    window.addEventListener('headspace-audio', audio);
    window.addEventListener('headspace-audio-status', changed);
    publishStatus({ state: 'starting', message: 'Connecting to Mac audio…' });
    void native('startAudioCapture').catch((error: unknown) => {
      if (!disposed)
        publishStatus({
          state: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Audio capture could not start.',
        });
    });
    return () => {
      disposed = true;
      window.removeEventListener('headspace-audio', audio);
      window.removeEventListener('headspace-audio-status', changed);
      latest = silentAudioFrame;
      receivedAt = -Infinity;
      void native('stopAudioCapture').catch(() => {});
    };
  }, [enabled, attempt]);
  return status;
}
