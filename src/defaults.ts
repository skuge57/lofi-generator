import type { EngineParams, InstrumentMix } from './engine/types';

export const DEFAULT_MIX: InstrumentMix = {
  chord: true,
  bass: true,
  kick: true,
  snare: true,
  hihat: true,
  vinyl: true,
  melody: true,
  counter: true,
};

export const DEFAULT_PARAMS: EngineParams = {
  bpm: 85,
  mood: 'chill',
  progressionId: 'warm-evening',
  reharmFlavor: 'diatonic',
  chordVoice: 'rhodes',
  masterVolume: 1,
  reverb: 0.5,
  vinyl: 0.3,
  tape: 0.35,
  crush: 0,
  lowCut: 60,
  highCut: 8000,
  mix: DEFAULT_MIX,
  octaveShift: 0,
  melodyOctave: 0,
  chordLength: 1.5,
  chordTiming: 0.3,
  swing: 0,
  drumProb: { kick: 1, snare: 1, hihat: 1 },
  keyShift: 0,
  bassStyle: 'simple',
  songForm: false,
  energy: 70,
  timeSignature: '4/4',
};
