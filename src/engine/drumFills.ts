export type DrumFillVoice = 'kick' | 'snare' | 'hihat';

export interface DrumFillPlan {
  kick: number[];
  snare: number[];
  hihat: number[];
}

export interface DrumFillEvent {
  voice: DrumFillVoice;
  step: number;
  velocity: number;
}

export interface DrumFillOptions {
  stepsPerBar: number;
  fillStartStep: number;
  energy: number;
  kickChance: number;
  snareChance: number;
  hihatChance: number;
  rnd: () => number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function makeBuffer(stepsPerBar: number): number[] {
  return new Array(Math.max(0, Math.floor(stepsPerBar))).fill(0);
}

function maybeSet(buffer: number[], step: number, chance: number, velocity: number, rnd: () => number): void {
  if (step < 0 || step >= buffer.length || chance <= 0 || rnd() >= clamp(chance, 0, 1)) return;
  buffer[step] = Math.max(buffer[step], clamp(velocity, 0, 1));
}

function setVelocity(buffer: number[], step: number, velocity: number): void {
  if (step < 0 || step >= buffer.length) return;
  buffer[step] = Math.max(buffer[step], clamp(velocity, 0, 1));
}

export function createDrumFillPlan(options: DrumFillOptions): DrumFillPlan {
  const stepsPerBar = Math.max(0, Math.floor(options.stepsPerBar));
  const plan: DrumFillPlan = {
    kick: makeBuffer(stepsPerBar),
    snare: makeBuffer(stepsPerBar),
    hihat: makeBuffer(stepsPerBar),
  };
  if (stepsPerBar === 0) return plan;

  const start = clamp(Math.floor(options.fillStartStep), 0, stepsPerBar - 1);
  const end = stepsPerBar;
  const span = Math.max(1, end - start);
  const energy = clamp(options.energy, 0, 1.15);
  const kickChance = clamp(options.kickChance, 0, 1);
  const snareChance = clamp(options.snareChance, 0, 1);
  const hihatChance = clamp(options.hihatChance, 0, 1);
  const rnd = options.rnd;
  const audibleSnare = snareChance >= 0.45;

  for (let step = start; step < end; step++) {
    const progress = span === 1 ? 1 : (step - start) / (span - 1);
    const isLast = step === end - 1;
    const isEvenFillStep = (step - start) % 2 === 0;
    const snareBaseChance = isLast
      ? 0.88
      : isEvenFillStep
        ? 0.56
        : 0.28 + energy * 0.22;
    const snareVelocity = 0.34 + progress * 0.48 + energy * 0.08 + rnd() * 0.08;

    if (audibleSnare && isLast) {
      setVelocity(plan.snare, step, snareVelocity);
    } else {
      maybeSet(plan.snare, step, snareChance * snareBaseChance, snareVelocity, rnd);
    }

    const hatChance = hihatChance * (isLast ? 0.18 : 0.16 + energy * 0.3);
    const hatVelocity = 0.22 + energy * 0.16 + rnd() * 0.08;
    maybeSet(plan.hihat, step, hatChance, hatVelocity, rnd);
  }

  const midpoint = start + Math.floor(span / 2);
  const kickLift = 0.45 + energy * 0.45;
  if (kickChance >= 0.65) {
    setVelocity(plan.kick, start, 0.48 + energy * 0.12 + rnd() * 0.08);
  } else {
    maybeSet(plan.kick, start, kickChance * kickLift * 0.48, 0.46 + energy * 0.1 + rnd() * 0.08, rnd);
  }
  if (midpoint !== start) {
    maybeSet(plan.kick, midpoint, kickChance * kickLift * 0.26, 0.38 + energy * 0.08 + rnd() * 0.07, rnd);
  }

  return plan;
}

export function drumFillEvents(plan: DrumFillPlan): DrumFillEvent[] {
  const events: DrumFillEvent[] = [];
  (['kick', 'snare', 'hihat'] as const).forEach(voice => {
    plan[voice].forEach((velocity, step) => {
      if (velocity > 0) events.push({ voice, step, velocity });
    });
  });
  return events.sort((a, b) => a.step - b.step || a.voice.localeCompare(b.voice));
}
