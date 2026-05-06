export type Mood = 'chill' | 'sad' | 'jazzy' | 'dreamy' | 'rainy' | 'dusty' | 'upbeat' | 'sleepy';
export type TimeSignature = '4/4' | '3/4' | '5/4' | '6/8';
export type BassStyle = 'simple' | 'walking' | 'lazy' | 'bounce' | 'dub' | 'pedal';
export type ReharmFlavor = 'diatonic' | 'jazzy' | 'darker' | 'dreamy' | 'spicy';
export type ChordVoice = 'rhodes' | 'wurlitzer' | 'muted-guitar' | 'vibraphone';

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
  /** When set, musical randomness is derived from this string and the arrangement fingerprint so the same URL/settings reproduce the same beat. */
  seed?: string;
  bpm: number;
  mood: Mood;
  progressionId: string;
  reharmFlavor: ReharmFlavor;
  chordVoice: ChordVoice;
  voiceLeading: boolean;
  masterVolume: number;
  reverb: number;
  vinyl: number;
  tape: number;
  crush: number;
  lowCut: number;
  highCut: number;
  mix: InstrumentMix;
  octaveShift: number;
  chordLength: number;
  chordTiming: number;
  swing: number;
  melodyOctave: number;
  drumProb: { kick: number; snare: number; hihat: number };
  keyShift: number;
  bassStyle: BassStyle;
  songForm: boolean;
  energy: number;
  timeSignature: TimeSignature;
}

export interface SongSection {
  id: string;
  label: string;
  bars: number;
  mutes?: (keyof InstrumentMix)[];
  drumDensity?: number;
  energy?: number;
  filterTilt?: number;
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
