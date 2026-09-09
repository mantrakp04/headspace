import { init, effect, surface, frame } from 'vgpu';
import { visualizerShader } from './visualizer-shader';
const output = document.querySelector('output');
async function check() {
  const gpu = await init();
  gpu.onError((error) => {
    if (output) output.textContent = String(error);
  });
  for (const mode of [1, 2, 4, 5, 6]) {
    const container = document.createElement('section');
    const label = document.createElement('p');
    label.textContent = `Mode ${mode}`;
    const canvas = document.createElement('canvas');
    container.appendChild(label);
    container.appendChild(canvas);
    document.querySelector('main')?.appendChild(container);
    const target = surface(gpu, canvas, {
      size: [648, 474],
      autoResize: false,
    });
    const shader = effect(gpu, visualizerShader, {
      set: {
        params: {
          time: 1,
          mode,
          hue: 0,
          glow: 1,
          energy: 1,
          bass: 0,
          mid: 0,
          treble: 0,
          aspect: 216 / 158,
        },
      },
    });
    await shader.compile({ colors: [target.format] });
    frame(gpu, (currentFrame) => currentFrame.pass(target, shader));
  }
  await gpu.settled();
  if (output)
    output.textContent = 'All five shaders compiled and rendered with WebGPU.';
}
void check().catch((error: unknown) => {
  if (output) output.textContent = String(error);
});
