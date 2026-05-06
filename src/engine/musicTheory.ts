import type { Mood, ProgressionDef, RhythmPattern } from './types';

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

const PATTERNS: Record<Mood, RhythmPattern> = {
  chill: {
    kick:  [true,false,false,false, false,false,false,false, true,false,false,false, false,false,false,false],
    snare: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    hihat: [false,false,true,false, true,false,true,false, true,false,true,false, true,false,true,false],
    chordSteps: [0, 8],
    bassSteps: [{ step: 0, interval: 0 }, { step: 8, interval: 1 }],
  },
  sad: {
    kick:  [true,false,false,false, true,false,false,false, true,false,false,false, false,false,false,false],
    snare: [false,false,false,false, true,false,false,false, false,false,false,false, true,false,false,false],
    hihat: [false,false,true,false, false,false,true,false, true,false,true,false, false,false,true,false],
    chordSteps: [0, 8],
    bassSteps: [{ step: 0, interval: 0 }, { step: 4, interval: 0 }, { step: 8, interval: 1 }],
  },
  jazzy: {
    kick:  [true,false,false,false, false,false,false,false, true,false,false,false, false,false,false,false],
    snare: [false,false,false,false, true,false,false,false, false,false,false,true, true,false,false,false],
    hihat: [false,false,true,false, true,false,true,false, false,false,true,false, true,false,true,false],
    chordSteps: [0, 6, 8],
    bassSteps: [{ step: 0, interval: 0 }, { step: 6, interval: 0 }, { step: 8, interval: 1 }, { step: 12, interval: 0 }],
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

export function getPattern(mood: Mood): RhythmPattern {
  return PATTERNS[mood];
}
