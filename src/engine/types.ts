export type Mood = 'chill' | 'sad' | 'jazzy';

export interface InstrumentMix {
  chord: boolean;
  bass: boolean;
  kick: boolean;
  snare: boolean;
  hihat: boolean;
  vinyl: boolean;
  melody: boolean;
}

export interface EngineParams {
  bpm: number;
  mood: Mood;
  progressionId: string;
  reverb: number;
  vinyl: number;
  lowCut: number;
  highCut: number;
  mix: InstrumentMix;
  octaveShift: number;
  chordLength: number;
  chordTiming: number;
  melodyOctave: number;
  drumProb: { kick: number; snare: number; hihat: number };
  keyShift: number;
  bassStyle: 'simple' | 'walking';
}

export interface ChordVoicing {
  name: string;
  notes: string[];
  duration: string;
}

export interface ProgressionDef {
  id: string;
  label: string;
  chords: ChordVoicing[];
  bassRoots: string[];
  bassThirds: string[];
  bassFifths: string[];
  melodyNotes: string[];
}

export interface RhythmPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  chordSteps: number[];
  bassSteps: { step: number; interval: number }[];
}
