import { describe, expect, it } from 'vitest';
import type { Mood, TimeSignature } from './types';
import {
  PROGRESSIONS,
  getPattern,
  getProgressionById,
  getReharmonizedProgression,
  transposeChordName,
} from './musicTheory';

const MOODS: Mood[] = ['chill', 'sad', 'jazzy', 'dreamy', 'rainy', 'dusty', 'upbeat', 'sleepy'];
const TIME_SIGNATURES: { signature: TimeSignature; stepsPerBar: number }[] = [
  { signature: '4/4', stepsPerBar: 16 },
  { signature: '3/4', stepsPerBar: 12 },
  { signature: '5/4', stepsPerBar: 20 },
  { signature: '6/8', stepsPerBar: 12 },
];

function expectStepsInBar(steps: number[], stepsPerBar: number) {
  expect(steps.every(step => Number.isInteger(step) && step >= 0 && step < stepsPerBar)).toBe(true);
}

describe('transposeChordName', () => {
  it('transposes chord roots while preserving chord quality', () => {
    expect(transposeChordName('Fmaj7', 2)).toBe('Gmaj7');
    expect(transposeChordName('Bb13', 1)).toBe('B13');
    expect(transposeChordName('Cmaj9', -1)).toBe('Bmaj9');
    expect(transposeChordName('Dm7b5', 12)).toBe('Dm7b5');
  });

  it('leaves unparseable chord names untouched', () => {
    expect(transposeChordName('not-a-chord', 5)).toBe('not-a-chord');
  });
});

describe('progression lookup', () => {
  it('returns progressions by id and falls back to the first progression', () => {
    expect(getProgressionById('blue-cafe')).toMatchObject({
      id: 'blue-cafe',
      label: 'Blue Café',
    });
    expect(getProgressionById('missing-progression')).toBe(PROGRESSIONS[0]);
  });

  it('keeps reharmonized progression arrays aligned with the source progression', () => {
    const source = getProgressionById('warm-evening');
    const reharmonized = getReharmonizedProgression('warm-evening', 'spicy');

    expect(reharmonized).not.toBe(source);
    expect(reharmonized.chords).toHaveLength(source.chords.length);
    expect(reharmonized.bassRoots).toHaveLength(source.chords.length);
    expect(reharmonized.bassThirds).toHaveLength(source.chords.length);
    expect(reharmonized.bassFifths).toHaveLength(source.chords.length);
    expect(reharmonized.melodyNotes).toBe(source.melodyNotes);
    expect(reharmonized.chords[0].notes).toHaveLength(source.chords[0].notes.length);
  });
});

describe('getPattern', () => {
  it('defaults to the 4/4 pattern for a mood', () => {
    expect(getPattern('chill')).toBe(getPattern('chill', '4/4'));
  });

  it('returns bounded pattern data for every mood and time signature', () => {
    for (const { signature, stepsPerBar } of TIME_SIGNATURES) {
      for (const mood of MOODS) {
        const pattern = getPattern(mood, signature);

        expect(pattern.stepsPerBar).toBe(stepsPerBar);
        expect(pattern.fillStartStep).toBeGreaterThanOrEqual(0);
        expect(pattern.fillStartStep).toBeLessThan(stepsPerBar);
        expect(pattern.kick).toHaveLength(stepsPerBar);
        expect(pattern.snare).toHaveLength(stepsPerBar);
        expect(pattern.hihat).toHaveLength(stepsPerBar);
        expect(pattern.kick.every(hit => typeof hit === 'boolean')).toBe(true);
        expect(pattern.snare.every(hit => typeof hit === 'boolean')).toBe(true);
        expect(pattern.hihat.every(hit => typeof hit === 'boolean')).toBe(true);

        expectStepsInBar(pattern.chordSteps, stepsPerBar);
        expectStepsInBar(pattern.walkingSteps, stepsPerBar);
        expectStepsInBar(pattern.lazySteps, stepsPerBar);
        expectStepsInBar(pattern.bassSteps.map(step => step.step), stepsPerBar);
        expect(pattern.bassSteps.every(step => Number.isInteger(step.interval) && step.interval >= 0)).toBe(true);
      }
    }
  });
});
