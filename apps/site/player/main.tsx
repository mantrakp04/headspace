import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Headspace from '../../desktop/src/headspace';
import { createPreviewPlayer } from './preview-player';

function EmbeddedPlayer() {
  const [preview] = useState(createPreviewPlayer);
  useEffect(() => preview.mount(), [preview]);
  useEffect(() => {
    let disposed = false;
    let ready = false;
    const announce = () =>
      window.parent.postMessage(
        'headspace-player-ready',
        window.location.origin,
      );
    function status(event: MessageEvent<unknown>) {
      if (
        ready &&
        event.source === window.parent &&
        event.origin === window.location.origin &&
        event.data === 'headspace-player-status'
      )
        announce();
    }
    window.addEventListener('message', status);
    const artwork = [...document.querySelectorAll('img, svg image')].map(
      (element) => {
        const image = new Image();
        image.src =
          element.getAttribute('src') ?? element.getAttribute('href') ?? '';
        return image.decode();
      },
    );
    void Promise.allSettled(artwork).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!disposed) {
            ready = true;
            announce();
          }
        }),
      );
    });
    return () => {
      disposed = true;
      window.removeEventListener('message', status);
    };
  }, []);
  return <Headspace preview={preview} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing player root.');
createRoot(root).render(<EmbeddedPlayer />);
