const frame = document.querySelector('iframe');
document
  .querySelectorAll<HTMLButtonElement>('button[data-scale]')
  .forEach((button) => {
    button.onclick = () => {
      if (!frame) return;
      document.querySelector('#surface')?.classList.remove('detail');
      const scale = Number(button.dataset.scale);
      frame.width = String(760 * scale);
      frame.height = String(394 * scale);
    };
  });
document
  .querySelectorAll<HTMLButtonElement>('button[data-backdrop]')
  .forEach((button) => {
    button.onclick = () => {
      document.body.className = button.dataset.backdrop ?? '';
    };
  });

document.querySelector('#edge-detail')?.addEventListener('click', () => {
  if (!frame) return;
  frame.width = '2280';
  frame.height = '1182';
  document.querySelector('#surface')?.classList.add('detail');
});
