import type { EngineParams } from './types';

/** Musical / arrangement fields that affect randomness in the scheduler (not master tone / BPM). */
const RNG_FINGERPRINT_KEYS: (keyof EngineParams)[] = [
  'bassStyle',
  'chordLength',
  'chordTiming',
  'drumProb',
  'energy',
  'keyShift',
  'melodyOctave',
  'mix',
  'mood',
  'octaveShift',
  'progressionId',
  'songForm',
  'timeSignature',
];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(',')}}`;
}

/** Deterministic string from params that influence random draw order / branches. */
export function fingerprintForRng(params: EngineParams): string {
  const o: Record<string, unknown> = {};
  for (const key of RNG_FINGERPRINT_KEYS) {
    o[key as string] = params[key];
  }
  return stableStringify(o);
}

function fnv1a32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return function mulberry() {
    let a = seed;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform [0, 1). Uses Math.random when seed is absent or empty. */
export function createRng(seed: string | undefined, params: EngineParams): () => number {
  const s = seed?.trim();
  if (!s) return Math.random;
  const h = fnv1a32(`${s}\0${fingerprintForRng(params)}`);
  return mulberry32(h === 0 ? 0x9e3779b9 : h);
}
