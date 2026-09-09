import assert from 'node:assert/strict';
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
  const base = {
    time: 1,
    mode: 1,
    hue: 0,
    glow: 1,
    energy: 0,
    aspect: 216 / 158,
    bass: 0,
    mid: 0,
    treble: 0,
  };
  const shader = effect(gpu, visualizerShader, { set: { params: base } });
  await shader.compile(output);
  for (const mode of [1, 2, 4, 5, 6]) {
    const frames: Uint8Array[] = [];
    const signals = [
      { bass: 0, mid: 0, treble: 0 },
      { bass: 0.9, mid: 0, treble: 0 },
      { bass: 0, mid: 0.9, treble: 0 },
      { bass: 0, mid: 0, treble: 0.9 },
    ];
    for (const signal of signals) {
      shader.set({ params: { ...base, mode, ...signal } });
      shader.draw(output);
      const pixels = await output.read();
      let light = 0;
      for (let i = 0; i < pixels.length; i += 4)
        light += pixels[i] + pixels[i + 1] + pixels[i + 2];
      assert(light > 0, `Mode ${mode} rendered black`);
      frames.push(new Uint8Array(pixels));
    }
    for (let i = 1; i < frames.length; i++) {
      assert.notDeepEqual(
        frames[i],
        frames[0],
        `Mode ${mode} ignores ${['silence', 'bass', 'mid', 'treble'][i]}`,
      );
    }
    shader.set({ params: { ...base, mode } });
    shader.draw(output);
    assert.deepEqual(
      new Uint8Array(await output.read()),
      frames[0],
      `Mode ${mode} does not settle at silence`,
    );
    console.log(
      `Mode ${mode} responds independently to bass, mid, and treble and returns to silence`,
    );
  }
  await gpu.settled();
  assert.equal(failure, false, 'GPU reported validation errors');
} finally {
  gpu.dispose();
}
