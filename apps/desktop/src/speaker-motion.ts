export type ConeMotion = {
  bassBaseline: number;
  excursion: number;
  velocity: number;
};

export const coneTravel = { x: 1.6, y: 4.15 };

export function updateConeMotion(
  motion: ConeMotion,
  bassLevel: number,
  dt: number,
  reducedMotion: boolean,
) {
  const bass = Math.max(0, bassLevel - 0.015);
  motion.bassBaseline +=
    (bass - motion.bassBaseline) * (1 - Math.exp(-dt / 180));
  const target = Math.max(
    -0.3,
    Math.min(1, bass * 0.65 + (bass - motion.bassBaseline) * 7),
  );
  if (reducedMotion) {
    motion.excursion = 0;
    motion.velocity = 0;
  } else {
    const steps = Math.max(1, Math.ceil(dt / 8));
    const step = dt / steps / 1000;
    for (let i = 0; i < steps; i++) {
      motion.velocity +=
        ((target - motion.excursion) * 1764 - motion.velocity * 38) * step;
      motion.excursion += motion.velocity * step;
    }
    if (
      bass === 0 &&
      motion.bassBaseline < 0.0001 &&
      Math.abs(motion.excursion) < 0.0001 &&
      Math.abs(motion.velocity) < 0.001
    ) {
      motion.excursion = 0;
      motion.velocity = 0;
    }
  }
}
