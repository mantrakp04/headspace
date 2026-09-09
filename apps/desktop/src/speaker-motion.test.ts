import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coneTravel,
  updateConeMotion,
  type ConeMotion,
} from './speaker-motion.ts';

function playKicks(fps: number) {
  const motion: ConeMotion = { bassBaseline: 0, excursion: 0, velocity: 0 };
  let peak = 0;
  let trough = 0;
  for (let frame = 0; frame < fps * 3; frame++) {
    const time = frame / fps;
    updateConeMotion(motion, time % 0.5 < 0.1 ? 0.3 : 0.12, 1000 / fps, false);
    if (time > 0.5) {
      peak = Math.max(peak, motion.excursion);
      trough = Math.min(trough, motion.excursion);
    }
  }
  return { motion, peak, trough };
}

void test('measured bass kicks visibly move cones and release between beats', () => {
  const { peak, trough } = playKicks(60);
  const travel = Math.hypot(coneTravel.x, coneTravel.y);
  assert.ok(
    peak * travel > 3,
    'a kick moves the cone more than 3 logical pixels',
  );
  assert.ok(
    (peak - trough) * travel > 5,
    'each kick has a visible push and release',
  );
  assert.ok(peak * travel < 6, 'the cone stays inside its fixed speaker rim');
});

void test('silence settles to exact rest and quiet input cannot restart motion', () => {
  const { motion } = playKicks(60);
  for (let frame = 0; frame < 180; frame++) {
    updateConeMotion(motion, 0, 1000 / 60, false);
  }
  assert.equal(motion.excursion, 0);
  assert.equal(motion.velocity, 0);
  for (let frame = 0; frame < 60; frame++) {
    updateConeMotion(motion, 0.01, 1000 / 60, false);
  }
  assert.equal(motion.excursion, 0);
  assert.equal(motion.velocity, 0);
});

void test('reduced motion immediately returns an active cone to neutral', () => {
  const { motion } = playKicks(60);
  assert.notEqual(motion.excursion, 0);
  updateConeMotion(motion, 0.3, 1000 / 60, true);
  assert.equal(motion.excursion, 0);
  assert.equal(motion.velocity, 0);
});

void test('cone travel remains comparable at 30, 60, and 120 frames per second', () => {
  const baseline = playKicks(60);
  for (const fps of [30, 120]) {
    const result = playKicks(fps);
    assert.ok(Math.abs(result.peak - baseline.peak) < 0.05);
    assert.ok(Math.abs(result.trough - baseline.trough) < 0.05);
  }
});
