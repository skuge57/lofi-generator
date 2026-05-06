import type { Mood, ProgressionDef, RhythmPattern, SongSection, TimeSignature } from './types';

export const PROGRESSIONS: ProgressionDef[] = [
  {
    id: 'warm-evening',
    label: 'Warm Evening',
    chords: [
      { name: 'Fmaj7', notes: ['A3','C4','E4','G4'],  duration: '1n' },
      { name: 'Em7',   notes: ['G3','B3','D4','F#4'], duration: '1n' },
      { name: 'Am7',   notes: ['C4','E4','G4','B4'],  duration: '1n' },
      { name: 'Dm7',   notes: ['F3','A3','C4','E4'],  duration: '1n' },
    ],
    bassRoots:  ['F2','E2','A2','D2'],
    bassThirds: ['A2','G2','C3','F2'],
    bassFifths: ['C3','B2','E3','A2'],
    melodyNotes: ['F5','G5','A5','C5','D5'],
  },
  {
    id: 'sunday-morning',
    label: 'Sunday Morning',
    chords: [
      { name: 'Cmaj7', notes: ['E3','G3','B3','D4'],  duration: '1n' },
      { name: 'Am7',   notes: ['C3','E3','G3','B3'],  duration: '1n' },
      { name: 'Fmaj7', notes: ['A3','C4','E4','G4'],  duration: '1n' },
      { name: 'G7',    notes: ['F3','A3','B3','D4'],  duration: '1n' },
    ],
    bassRoots:  ['C2','A2','F2','G2'],
    bassThirds: ['E2','C3','A2','B2'],
    bassFifths: ['G2','E3','C3','D3'],
    melodyNotes: ['C5','D5','E5','G5','A5'],
  },
  {
    id: 'soft-gold',
    label: 'Soft Gold',
    chords: [
      { name: 'Ebmaj7', notes: ['G3','Bb3','D4','F4'],  duration: '1n' },
      { name: 'Cm7',    notes: ['Eb3','G3','Bb3','D4'], duration: '1n' },
      { name: 'Abmaj7', notes: ['C4','Eb4','G4','Bb4'], duration: '1n' },
      { name: 'Bb7',    notes: ['D4','F4','Ab4','C5'],  duration: '1n' },
    ],
    bassRoots:  ['Eb2','C2','Ab2','Bb2'],
    bassThirds: ['G2','Eb2','C3','D3'],
    bassFifths: ['Bb2','G2','Eb3','F2'],
    melodyNotes: ['Eb5','F5','G5','Bb5','C5'],
  },
  {
    id: 'autumn-rain',
    label: 'Autumn Rain',
    chords: [
      { name: 'Am7',   notes: ['C4','E4','G4','B4'],  duration: '1n' },
      { name: 'Dm7',   notes: ['F3','A3','C4','E4'],  duration: '1n' },
      { name: 'Gmaj7', notes: ['B3','D4','F#4','A4'], duration: '1n' },
      { name: 'Cmaj7', notes: ['E4','G4','B4','D5'],  duration: '1n' },
    ],
    bassRoots:  ['A2','D2','G2','C2'],
    bassThirds: ['C3','F2','B2','E2'],
    bassFifths: ['E3','A2','D3','G2'],
    melodyNotes: ['A5','C5','D5','E5','G5'],
  },
  {
    id: 'late-night',
    label: 'Late Night',
    chords: [
      { name: 'Em7',   notes: ['G3','B3','D4','E4'],   duration: '1n' },
      { name: 'Cmaj7', notes: ['E3','G3','B3','D4'],   duration: '1n' },
      { name: 'Gmaj7', notes: ['B3','D4','F#4','A4'],  duration: '1n' },
      { name: 'Dmaj7', notes: ['F#3','A3','C#4','E4'], duration: '1n' },
    ],
    bassRoots:  ['E2','C2','G2','D2'],
    bassThirds: ['G2','E2','B2','F#2'],
    bassFifths: ['B2','G2','D3','A2'],
    melodyNotes: ['E5','F#5','G5','B5','D5'],
  },
  {
    id: 'city-fog',
    label: 'City Fog',
    chords: [
      { name: 'Dm7',   notes: ['F3','A3','C4','E4'],  duration: '1n' },
      { name: 'Gm7',   notes: ['Bb3','D4','F4','A4'], duration: '1n' },
      { name: 'Cmaj7', notes: ['E4','G4','B4','D5'],  duration: '1n' },
      { name: 'Fmaj7', notes: ['A3','C4','E4','G4'],  duration: '1n' },
    ],
    bassRoots:  ['D2','G2','C2','F2'],
    bassThirds: ['F2','Bb2','E2','A2'],
    bassFifths: ['A2','D3','G2','C3'],
    melodyNotes: ['D5','F5','G5','A5','C5'],
  },
  {
    id: 'rooftop-jazz',
    label: 'Rooftop Jazz',
    chords: [
      { name: 'Cmaj9', notes: ['E4','G4','B4','D5'],  duration: '1n' },
      { name: 'Am9',   notes: ['C4','E4','G4','B4'],  duration: '1n' },
      { name: 'Dm9',   notes: ['F3','A3','C4','E4'],  duration: '1n' },
      { name: 'G13',   notes: ['B3','D4','F4','A4'],  duration: '1n' },
    ],
    bassRoots:  ['C2','A2','D2','G2'],
    bassThirds: ['E2','C3','F2','B2'],
    bassFifths: ['G2','E3','A2','D3'],
    melodyNotes: ['C5','D5','E5','G5','A5'],
  },
  {
    id: 'blue-cafe',
    label: 'Blue Café',
    chords: [
      { name: 'Dm7',   notes: ['F3','A3','C4','E4'],  duration: '1n' },
      { name: 'G7',    notes: ['F3','A3','B3','D4'],  duration: '1n' },
      { name: 'Cmaj7', notes: ['E4','G4','B4','D5'],  duration: '1n' },
      { name: 'Am7',   notes: ['C4','E4','G4','B4'],  duration: '1n' },
    ],
    bassRoots:  ['D2','G2','C2','A2'],
    bassThirds: ['F2','B2','E2','C3'],
    bassFifths: ['A2','D3','G2','E3'],
    melodyNotes: ['D5','F5','G5','A5','C5'],
  },
];

function hits(stepsPerBar: number, steps: number[]): boolean[] {
  const out = new Array<boolean>(stepsPerBar).fill(false);
  steps.forEach(step => { out[step] = true; });
  return out;
}

function pattern(
  stepsPerBar: number,
  fillStartStep: number,
  kick: number[],
  snare: number[],
  hihat: number[],
  chordSteps: number[],
  bassSteps: { step: number; interval: number }[],
  walkingSteps: number[],
  lazySteps: number[]
): RhythmPattern {
  return {
    stepsPerBar,
    fillStartStep,
    kick: hits(stepsPerBar, kick),
    snare: hits(stepsPerBar, snare),
    hihat: hits(stepsPerBar, hihat),
    chordSteps,
    bassSteps,
    walkingSteps,
    lazySteps,
  };
}

const PATTERNS: Record<TimeSignature, Record<Mood, RhythmPattern>> = {
  '4/4': {
    chill: pattern(16, 12, [0, 8], [4, 12], [2, 4, 6, 8, 10, 12, 14], [0, 8],
      [{ step: 0, interval: 0 }, { step: 8, interval: 1 }], [0, 4, 8, 12], [0, 10]),
    sad: pattern(16, 12, [0, 4, 8], [4, 12], [2, 6, 8, 10, 14], [0, 8],
      [{ step: 0, interval: 0 }, { step: 4, interval: 0 }, { step: 8, interval: 1 }], [0, 4, 8, 12], [0, 10]),
    jazzy: pattern(16, 12, [0, 8], [4, 11, 12], [2, 4, 6, 10, 12, 14], [0, 6, 8],
      [{ step: 0, interval: 0 }, { step: 6, interval: 0 }, { step: 8, interval: 1 }, { step: 12, interval: 0 }], [0, 4, 8, 12], [0, 10]),
  },
  '3/4': {
    chill: pattern(12, 8, [0, 8], [4], [2, 4, 6, 8, 10], [0, 6],
      [{ step: 0, interval: 0 }, { step: 6, interval: 1 }], [0, 4, 8], [0, 7]),
    sad: pattern(12, 8, [0, 4, 8], [4], [2, 6, 10], [0, 6],
      [{ step: 0, interval: 0 }, { step: 4, interval: 0 }, { step: 8, interval: 1 }], [0, 4, 8], [0, 6]),
    jazzy: pattern(12, 8, [0, 8], [4, 9], [2, 4, 6, 10], [0, 5, 8],
      [{ step: 0, interval: 0 }, { step: 5, interval: 0 }, { step: 8, interval: 1 }], [0, 4, 8], [0, 7]),
  },
  '5/4': {
    chill: pattern(20, 16, [0, 8, 16], [4, 12], [2, 4, 6, 8, 10, 12, 14, 16, 18], [0, 8, 16],
      [{ step: 0, interval: 0 }, { step: 8, interval: 1 }, { step: 16, interval: 0 }], [0, 4, 8, 12, 16], [0, 14]),
    sad: pattern(20, 16, [0, 4, 10, 16], [4, 12], [2, 6, 10, 14, 18], [0, 10],
      [{ step: 0, interval: 0 }, { step: 4, interval: 0 }, { step: 10, interval: 1 }, { step: 16, interval: 0 }], [0, 4, 8, 12, 16], [0, 12]),
    jazzy: pattern(20, 16, [0, 8, 14], [4, 11, 12, 18], [2, 4, 6, 10, 12, 14, 18], [0, 6, 10, 16],
      [{ step: 0, interval: 0 }, { step: 6, interval: 0 }, { step: 10, interval: 1 }, { step: 16, interval: 0 }], [0, 4, 8, 12, 16], [0, 14]),
  },
  '6/8': {
    chill: pattern(12, 8, [0, 6], [6], [2, 4, 6, 8, 10], [0, 6],
      [{ step: 0, interval: 0 }, { step: 6, interval: 1 }], [0, 3, 6, 9], [0, 8]),
    sad: pattern(12, 8, [0, 3, 6], [6], [2, 4, 8, 10], [0, 6],
      [{ step: 0, interval: 0 }, { step: 3, interval: 0 }, { step: 6, interval: 1 }], [0, 3, 6, 9], [0, 8]),
    jazzy: pattern(12, 8, [0, 6, 9], [3, 6], [2, 4, 6, 8, 10], [0, 4, 6],
      [{ step: 0, interval: 0 }, { step: 4, interval: 0 }, { step: 6, interval: 1 }, { step: 9, interval: 0 }], [0, 3, 6, 9], [0, 8]),
  },
};

const CHROMATIC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_SEMI: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6, 'G': 7,
  'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

export function transposeChordName(chordName: string, semitones: number): string {
  if (semitones === 0) return chordName;
  const match = chordName.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chordName;
  const [, root, quality] = match;
  const semi = NOTE_SEMI[root];
  if (semi === undefined) return chordName;
  return CHROMATIC[(semi + semitones + 12) % 12] + quality;
}

export function getProgressionById(id: string): ProgressionDef {
  return PROGRESSIONS.find(p => p.id === id) ?? PROGRESSIONS[0];
}

export function getPattern(mood: Mood, timeSignature: TimeSignature = '4/4'): RhythmPattern {
  return PATTERNS[timeSignature][mood];
}

// Song arrangement: a fixed A/B/bridge form that loops. Each section can mute
// instruments, thin out the drum probability, and optionally trigger a snare
// fill on its last bar to telegraph the next section.
export const SONG_ARRANGEMENT: SongSection[] = [
  { id: 'intro',  label: 'Intro',  bars: 4, mutes: ['kick', 'snare', 'hihat'], fillOnLastBar: true },
  { id: 'A',      label: 'A',      bars: 8 },
  { id: 'B',      label: 'B',      bars: 8, drumDensity: 0.65 },
  { id: 'A',      label: 'A',      bars: 8 },
  { id: 'bridge', label: 'Bridge', bars: 4, mutes: ['kick', 'snare'], drumDensity: 0.6, fillOnLastBar: true },
  { id: 'A',      label: 'A',      bars: 8 },
];

const ARRANGEMENT_TOTAL_BARS = SONG_ARRANGEMENT.reduce((s, sec) => s + sec.bars, 0);

export function locateSection(bar: number): { index: number; barInSection: number } {
  const pos = ((bar % ARRANGEMENT_TOTAL_BARS) + ARRANGEMENT_TOTAL_BARS) % ARRANGEMENT_TOTAL_BARS;
  let cum = 0;
  for (let i = 0; i < SONG_ARRANGEMENT.length; i++) {
    const len = SONG_ARRANGEMENT[i].bars;
    if (pos < cum + len) return { index: i, barInSection: pos - cum };
    cum += len;
  }
  return { index: 0, barInSection: 0 };
}
