import { init, effect, target } from 'vgpu/node';
import { visualizerShader } from './visualizer-shader.ts';
const gpu = await init();
let failure = false;
gpu.onError((error) => {
  console.error(error);
  failure = true;
});
try {
  const output = target(gpu, { size: [216, 158], format: 'rgba8unorm' });
  const shader = effect(gpu, visualizerShader, {
    set: {
      params: {
        time: 1,
        mode: 1,
        hue: 0,
        glow: 1,
        energy: 1,
        aspect: 216 / 158,
      },
    },
  });
  await shader.compile(output);
  for (const mode of [1, 2, 4, 5, 6]) {
    const frames = [];
    for (const time of [1, 2]) {
      shader.set({
        params: { time, mode, hue: 0, glow: 1, energy: 1, aspect: 216 / 158 },
      });
      shader.draw(output);
      const pixels = await output.read();
      let light = 0;
      for (let i = 0; i < pixels.length; i += 4)
        light += pixels[i] + pixels[i + 1] + pixels[i + 2];
      if (light === 0) throw new Error(`Mode ${mode} rendered black`);
      frames.push(light);
    }
    if (frames[0] === frames[1])
      throw new Error(`Mode ${mode} did not animate`);
    console.log(`Mode ${mode}: nonblack, animated`, frames);
  }
  await gpu.settled();
  if (failure) process.exitCode = 1;
} finally {
  gpu.dispose();
}
