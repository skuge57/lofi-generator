export type Mood = 'chill' | 'sad' | 'jazzy' | 'dreamy' | 'rainy' | 'dusty' | 'upbeat' | 'sleepy';
export type SceneId =
  | 'dusty-record'
  | 'rainy-window'
  | 'cafe'
  | 'train'
  | 'distant-street'
  | 'fireplace'
  | 'late-night';
export type TimeSignature = '4/4' | '3/4' | '5/4' | '6/8';
export const BASS_STYLES = [
  'root-only',
  'synth-sub',
  'dub',
  'lazy-guitarist',
  'walking-jazz',
  'upright',
  'off-grid',
] as const;
export type BassStyle = typeof BASS_STYLES[number];
export type DrumKit = 'synth' | 'sample';
export type ReharmFlavor = 'diatonic' | 'jazzy' | 'darker' | 'dreamy' | 'spicy';
export const SONG_FORM_IDS = ['classic', 'aaba', 'verse-chorus', 'loop', 'through', 'ballad'] as const;
export type SongFormId = typeof SONG_FORM_IDS[number];
export type ChordVoice =
  | 'rhodes'
  | 'wurlitzer'
  | 'muted-guitar'
  | 'vibraphone'
  | 'tape-choir'
  | 'juno-strings'
  | 'organ'
  | 'glass-pad';

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

export type InstrumentVolumes = Record<keyof InstrumentMix, number>;

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
  instrumentVolume: InstrumentVolumes;
  octaveShift: number;
  chordLength: number;
  chordTiming: number;
  sidechainDucking: boolean;
  swing: number;
  drumKit: DrumKit;
  melodyOctave: number;
  drumProb: { kick: number; snare: number; hihat: number };
  keyShift: number;
  bassStyle: BassStyle;
  songForm: boolean;
  songFormId: SongFormId;
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
