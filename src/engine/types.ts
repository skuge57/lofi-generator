export type Mood = 'chill' | 'sad' | 'jazzy';
export type TimeSignature = '4/4' | '3/4' | '5/4' | '6/8';
export type BassStyle = 'simple' | 'walking' | 'lazy' | 'bounce' | 'dub' | 'pedal';

export interface InstrumentMix {
  chord: boolean;
  bass: boolean;
  kick: boolean;
  snare: boolean;
  hihat: boolean;
  vinyl: boolean;
  melody: boolean;
  counter: boolean;
}

export interface EngineParams {
  bpm: number;
  mood: Mood;
  progressionId: string;
  reverb: number;
  vinyl: number;
  tape: number;
  lowCut: number;
  highCut: number;
  mix: InstrumentMix;
  octaveShift: number;
  chordLength: number;
  chordTiming: number;
  melodyOctave: number;
  drumProb: { kick: number; snare: number; hihat: number };
  keyShift: number;
  bassStyle: BassStyle;
  songForm: boolean;
  timeSignature: TimeSignature;
}

export interface SongSection {
  id: string;
  label: string;
  bars: number;
  mutes?: (keyof InstrumentMix)[];
  drumDensity?: number;
  fillOnLastBar?: boolean;
}

export interface SectionInfo {
  id: string;
  label: string;
  index: number;
  barInSection: number;
  totalBars: number;
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
  stepsPerBar: number;
  fillStartStep: number;
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  chordSteps: number[];
  bassSteps: { step: number; interval: number }[];
  walkingSteps: number[];
  lazySteps: number[];
}
