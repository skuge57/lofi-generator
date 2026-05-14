import { describe, expect, it } from 'vitest';
import { createDrumFillPlan, drumFillEvents } from './drumFills';
import { getPattern } from './musicTheory';
import type { TimeSignature } from './types';

const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '5/4', '6/8'];

function mulberry32(seed: number): () => number {
  return function rnd() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('createDrumFillPlan', () => {
  it('keeps fill events inside the fill window for every time signature', () => {
    for (const signature of TIME_SIGNATURES) {
      const pattern = getPattern('chill', signature);
      const plan = createDrumFillPlan({
        stepsPerBar: pattern.stepsPerBar,
        fillStartStep: pattern.fillStartStep,
        energy: 0.9,
        kickChance: 1,
        snareChance: 1,
        hihatChance: 1,
        rnd: mulberry32(1234),
      });

      const events = drumFillEvents(plan);
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => event.step >= pattern.fillStartStep && event.step < pattern.stepsPerBar)).toBe(true);
    }
  });

  it('only emits known drum voices with bounded velocities', () => {
    const pattern = getPattern('jazzy', '5/4');
    const events = drumFillEvents(createDrumFillPlan({
      stepsPerBar: pattern.stepsPerBar,
      fillStartStep: pattern.fillStartStep,
      energy: 1,
      kickChance: 1,
      snareChance: 1,
      hihatChance: 1,
      rnd: mulberry32(44),
    }));

    expect(events.every(event => ['kick', 'snare', 'hihat'].includes(event.voice))).toBe(true);
    expect(events.every(event => event.velocity > 0 && event.velocity <= 1)).toBe(true);
  });

  it('makes default-strength fills audible at the final step', () => {
    const pattern = getPattern('chill', '4/4');
    const plan = createDrumFillPlan({
      stepsPerBar: pattern.stepsPerBar,
      fillStartStep: pattern.fillStartStep,
      energy: 0.7,
      kickChance: 1,
      snareChance: 1,
      hihatChance: 1,
      rnd: mulberry32(7),
    });

    expect(plan.kick[pattern.fillStartStep]).toBeGreaterThan(0);
    expect(plan.snare[pattern.stepsPerBar - 1]).toBeGreaterThan(0.75);
  });

  it('handles fully dropped drum probabilities without events', () => {
    const pattern = getPattern('sleepy', '6/8');
    const plan = createDrumFillPlan({
      stepsPerBar: pattern.stepsPerBar,
      fillStartStep: pattern.fillStartStep,
      energy: 0.2,
      kickChance: 0,
      snareChance: 0,
      hihatChance: 0,
      rnd: mulberry32(99),
    });

    expect(drumFillEvents(plan)).toEqual([]);
    expect(plan.kick).toHaveLength(pattern.stepsPerBar);
    expect(plan.snare).toHaveLength(pattern.stepsPerBar);
    expect(plan.hihat).toHaveLength(pattern.stepsPerBar);
  });

  it('is deterministic for the same random stream and inputs', () => {
    const pattern = getPattern('dusty', '4/4');
    const options = {
      stepsPerBar: pattern.stepsPerBar,
      fillStartStep: pattern.fillStartStep,
      energy: 0.74,
      kickChance: 0.8,
      snareChance: 0.9,
      hihatChance: 0.65,
    };

    expect(createDrumFillPlan({ ...options, rnd: mulberry32(2026) })).toEqual(
      createDrumFillPlan({ ...options, rnd: mulberry32(2026) })
    );
  });
});
