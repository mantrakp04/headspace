import { useEffect, useRef } from 'react';

export function PlayerPreview({ onReady }: { onReady: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  function requestStatus() {
    frame.current?.contentWindow?.postMessage(
      'headspace-player-status',
      window.location.origin,
    );
  }
  useEffect(() => {
    function ready(event: MessageEvent<unknown>) {
      if (
        event.source === frame.current?.contentWindow &&
        event.origin === window.location.origin &&
        event.data === 'headspace-player-ready'
      )
        onReady();
    }
    window.addEventListener('message', ready);
    frame.current?.contentWindow?.postMessage(
      'headspace-player-status',
      window.location.origin,
    );
    return () => window.removeEventListener('message', ready);
  }, [onReady]);
  return (
    <div className="player-preview">
      <div className="player-orbits" aria-hidden="true">
        <div className="player-orbit player-orbit-a" />
        <div className="player-orbit player-orbit-b" />
        <div className="player-orbit player-orbit-c" />
      </div>
      <iframe
        ref={frame}
        onLoad={requestStatus}
        className="player-frame"
        allow="autoplay"
        src="/embedded-player/player/index.html"
        title="Headspace interactive player"
      />
    </div>
  );
}
