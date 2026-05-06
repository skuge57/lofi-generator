import * as Tone from 'tone';
import { createRng } from './rng';
import { getReharmonizedProgression, getPattern, SONG_ARRANGEMENT, locateSection } from './musicTheory';
import type { BassStyle, ChordVoice, EngineParams, Mood, ProgressionDef, ReharmFlavor, RhythmPattern, SectionInfo, InstrumentMix, TimeSignature } from './types';

function cloneEngineParams(p: EngineParams): EngineParams {
  return {
    ...p,
    mix: { ...p.mix },
    instrumentVolume: { ...p.instrumentVolume },
    drumProb: { ...p.drumProb },
  };
}

const DEFAULT_STEPS_PER_BAR = 16;
const REVERB_SEND_GAIN = 1.15;
const SIDECHAIN_CHORD_FLOOR = 0.56;
const SIDECHAIN_BASS_FLOOR = 0.68;
const SIDECHAIN_ATTACK_SECONDS = 0.012;
const SIDECHAIN_RELEASE_SECONDS = 0.24;
type ChordSynth = Tone.PolySynth<Tone.FMSynth | Tone.AMSynth | Tone.Synth>;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type MelodyDur = '8n' | '4n' | '2n';

interface Motif {
  // Pitch deltas relative to the bar's anchor position in the sorted melody pool.
  // Some phrase endings intentionally start above the anchor before resolving.
  deltas: number[];
  durs: MelodyDur[];
  // Where in the bar the motif starts (0–4 sixteenths).
  startStep: number;
  // Phrase-level lift/drop so each chord slot keeps a recognizable contour.
  anchorOffset: number;
}

export class LofiEngine {
  private chordSynth: ChordSynth;
  private chordTremolo: Tone.Tremolo;
  private guitarSampler: Tone.Sampler;
  private guitarFilter: Tone.Filter;
  private bassSynth: Tone.MonoSynth;
  private melodySynth: Tone.Synth;
  private counterSynth: Tone.Synth;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hihat: Tone.NoiseSynth;
  private hihatFilter: Tone.Filter;
  private vinyl: Tone.Noise;
  private vinylGain: Tone.Gain;
  private vinylDustGain: Tone.Gain;
  private vinylDustFilter: Tone.Filter;
  private vinylClick: Tone.NoiseSynth;
  private vinylClickFilter: Tone.Filter;
  private vinylPop: Tone.MembraneSynth;

  private reverb: Tone.Reverb;
  private reverbSend: Tone.Gain;
  private masterVolume: Tone.Gain;
  private limiter: Tone.Limiter;
  private lowpass: Tone.Filter;
  private highpass: Tone.Filter;
  private tapeSaturation: Tone.Distortion;
  private tapeWow: Tone.Vibrato;
  private tapeFlutter: Tone.Vibrato;
  private tapeTremble: Tone.Tremolo;
  private bitCrusher: Tone.BitCrusher;
  private gates: Record<keyof EngineParams['mix'], Tone.Gain>;
  private chordSidechain: Tone.Gain;
  private bassSidechain: Tone.Gain;

  private sequence: Tone.Sequence<number> | null = null;
  private currentMood: Mood;
  private currentProgressionId: string;
  private currentReharmFlavor: ReharmFlavor = 'diatonic';
  private currentChordVoice: ChordVoice = 'rhodes';
  private currentVoiceLeading = false;
  private currentOctaveShift = 0;
  private currentMelodyOctave = 0;
  private currentChordLength = 1.5;
  private currentChordTiming = 0;
  private currentSidechainDucking = true;
  private currentDrumProb = { kick: 1, snare: 1, hihat: 1 };
  private currentKeyShift = 0;
  private currentBassStyle: BassStyle = 'simple';
  private currentTimeSignature: TimeSignature = '4/4';
  private currentEnergy = 70;
  private currentStepsPerBar = DEFAULT_STEPS_PER_BAR;
  private currentStep = 0;
  private chordIndex = 0;

  // Song-form state
  private songFormEnabled = false;
  private currentBar = 0;
  private sectionIdx = 0;
  private barInSection = 0;
  private isFillBar = false;
  private activeEnergy = 0.7;
  private activeKickScale = 1;
  private activeSnareScale = 1;
  private activeHihatScale = 1;
  private activeMelodyChance = 1;
  private baseLowCut = 60;
  private baseHighCut = 8000;

  // Pre-computed caches — rebuilt only when params change, never in tick()
  private cachedProg!: ProgressionDef;
  private cachedPattern!: RhythmPattern;
  private cachedChordStepSet!: Set<number>;
  private cachedBassStepToInterval!: Map<number, number>;
  private cachedChordNotes!: string[][];
  private cachedBassRoots!: string[];
  private cachedBassThirds!: string[];
  private cachedBassFifths!: string[];
  private cachedBassOctaves!: string[];
  private cachedBassApproach!: string[];
  private cachedBassQuarterStep = 4;
  private cachedBassHalfStep = 8;
  private cachedBassThreeQuarterStep = 12;
  private cachedBassPickupStep = 14;
  private cachedMelodyNotes!: string[];
  private cachedMelodyFreqs!: number[];
  private cachedMutedGuitarUpNotes!: string[][];
  private cachedTapeChoirNotes!: string[][];
  private cachedOrganNotes!: string[][];
  private cachedGlassPadNotes!: string[][];
  // Indices into cachedMelodyNotes sorted by ascending pitch — stable across bars.
  private cachedSortedMelodyIdx!: number[];
  // Per chord, the positions in cachedSortedMelodyIdx whose pitch class belongs
  // to the chord. Used to resolve phrase endings onto chord tones (tension/release)
  // and to harmonize the counter line.
  private cachedChordTonePos!: number[][];

  // Pre-allocated melody pattern buffer — cleared and reused each bar
  private melodyPatternBuf: ({ note: string; dur: MelodyDur } | null)[] = new Array(DEFAULT_STEPS_PER_BAR).fill(null);
  // Counter-melody buffer: a soft harmony/answer line below the lead,
  // populated sparsely so it supports the hook instead of competing with it.
  private counterPatternBuf: ({ note: string; dur: MelodyDur } | null)[] = new Array(DEFAULT_STEPS_PER_BAR).fill(null);
  private prevMelodyNote: string | null = null;

  // Theme state — a call/answer phrase spanning the full chord progression.
  // It repeats for several progression cycles before a new idea is composed.
  private theme: Motif[] | null = null;
  private themeCycleAge = 0;
  private themeMaxCycles = 0;
  private lastThemeChordIndex = -1;

  private rnd: () => number = Math.random;
  /** Latest params from the UI — used to build deterministic RNG state from seed + arrangement. */
  private snap: EngineParams;
  private seededMode = false;

  constructor(params: EngineParams) {
    this.snap = cloneEngineParams(params);
    this.attachRng();
    this.currentMood = params.mood;
    this.currentProgressionId = params.progressionId;
    this.currentReharmFlavor = params.reharmFlavor;
    this.currentChordVoice = params.chordVoice;
    this.currentVoiceLeading = params.voiceLeading;
    this.currentOctaveShift = params.octaveShift;
    this.currentMelodyOctave = params.melodyOctave;
    this.currentChordLength = params.chordLength;
    this.currentChordTiming = params.chordTiming;
    this.currentSidechainDucking = params.sidechainDucking;
    this.currentDrumProb = { ...params.drumProb };
    this.currentKeyShift = params.keyShift;
    this.currentBassStyle = params.bassStyle;
    this.currentTimeSignature = params.timeSignature;
    this.currentEnergy = params.energy;
    this.songFormEnabled = params.songForm;
    this.baseLowCut = params.lowCut;
    this.baseHighCut = params.highCut;

    // Effects chain: instruments → gates → highpass → lowpass → tape → crusher → limiter
    // Reverb runs in parallel as a send so adding ambience does not fade out the dry mix.
    // Chorus removed from master bus — it processed all instruments simultaneously.
    // The chord tremolo still provides movement on the pad specifically.
    this.masterVolume = new Tone.Gain(clamp(params.masterVolume, 0, 2)).toDestination();
    this.limiter = new Tone.Limiter(-3).connect(this.masterVolume);
    this.reverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.025, wet: 1 }).connect(this.limiter);
    this.reverbSend = new Tone.Gain(params.reverb * REVERB_SEND_GAIN).connect(this.reverb);
    this.tapeTremble = new Tone.Tremolo({
      frequency: 0.65,
      depth: 0,
      type: 'sine',
      spread: 0,
      wet: 0,
    }).start();
    this.bitCrusher = new Tone.BitCrusher(16);
    this.bitCrusher.wet.value = 0;
    this.bitCrusher.connect(this.limiter);
    this.bitCrusher.connect(this.reverbSend);
    this.tapeTremble.connect(this.bitCrusher);
    this.tapeFlutter = new Tone.Vibrato({
      frequency: 6.2,
      depth: 0,
      maxDelay: 0.014,
      type: 'triangle',
      wet: 0,
    }).connect(this.tapeTremble);
    this.tapeWow = new Tone.Vibrato({
      frequency: 0.18,
      depth: 0,
      maxDelay: 0.065,
      type: 'sine',
      wet: 0,
    }).connect(this.tapeFlutter);
    this.tapeSaturation = new Tone.Distortion({
      distortion: 0,
      oversample: '2x',
      wet: 0,
    }).connect(this.tapeWow);
    this.lowpass = new Tone.Filter(params.highCut, 'lowpass').connect(this.tapeSaturation);
    this.highpass = new Tone.Filter(params.lowCut, 'highpass').connect(this.lowpass);

    const g = (on: boolean, level: number) => new Tone.Gain(on ? level : 0).connect(this.highpass);
    this.gates = {
      chord:   g(params.mix.chord, params.instrumentVolume.chord),
      bass:    g(params.mix.bass, params.instrumentVolume.bass),
      kick:    g(params.mix.kick, params.instrumentVolume.kick),
      snare:   g(params.mix.snare, params.instrumentVolume.snare),
      hihat:   g(params.mix.hihat, params.instrumentVolume.hihat),
      melody:  g(params.mix.melody, params.instrumentVolume.melody),
      counter: g(params.mix.counter, params.instrumentVolume.counter),
      vinyl:   new Tone.Gain(params.mix.vinyl ? params.vinyl * 0.03 * params.instrumentVolume.vinyl : 0).connect(this.limiter),
    };

    this.chordSidechain = new Tone.Gain(1).connect(this.gates.chord);
    this.bassSidechain = new Tone.Gain(1).connect(this.gates.bass);

    this.chordTremolo = new Tone.Tremolo(4, 0.3).connect(this.chordSidechain).start();
    this.guitarFilter = new Tone.Filter({
      frequency: 2600,
      type: 'lowpass',
      Q: 0.6,
    }).connect(this.chordTremolo);
    this.guitarSampler = new Tone.Sampler({
      urls: {
        C3: 'C3.wav',
        'C#3': 'Cs3.wav',
        D3: 'D3.wav',
        'D#3': 'Ds3.wav',
        E3: 'E3.wav',
        F3: 'F3.wav',
        'F#3': 'Fs3.wav',
        G3: 'G3.wav',
        'G#3': 'Gs3.wav',
        A3: 'A3.wav',
        'A#3': 'As3.wav',
        B3: 'B3.wav',
        C4: 'C4.wav',
        'C#4': 'Cs4.wav',
        D4: 'D4.wav',
        'D#4': 'Ds4.wav',
        E4: 'E4.wav',
        F4: 'F4.wav',
        'F#4': 'Fs4.wav',
        G4: 'G4.wav',
        'G#4': 'Gs4.wav',
        A4: 'A4.wav',
        'A#4': 'As4.wav',
        B4: 'B4.wav',
        C5: 'C5.wav',
      },
      baseUrl: `${import.meta.env.BASE_URL}samples/guitar/`,
      attack: 0.001,
      release: 0.045,
      curve: 'exponential',
      volume: -8,
    }).connect(this.guitarFilter);
    this.chordSynth = this.createChordSynth(params.chordVoice);
    this.chordSynth.connect(this.chordTremolo);

    // Bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { frequency: 300, type: 'lowpass' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.8 },
      volume: -10,
    }).connect(this.bassSidechain);

    // Melody — soft sine lead
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.55, release: 1.4 },
      volume: -18,
    }).connect(this.gates.melody);

    // Counter — softer triangle voice that sits below the lead. Slower attack
    // and quieter so it reads as a supporting harmony, not a doubled lead.
    this.counterSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.09, decay: 0.4, sustain: 0.45, release: 1.6 },
      volume: -24,
    }).connect(this.gates.counter);

    // Kick
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -8,
    }).connect(this.gates.kick);

    // Snare
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -18,
    }).connect(this.gates.snare);

    // Hi-hat
    this.hihatFilter = new Tone.Filter({
      frequency: 3200,
      type: 'highpass',
      Q: 0.7,
    }).connect(this.gates.hihat);
    this.hihat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.018 },
      volume: -15,
    }).connect(this.hihatFilter);

    // Vinyl texture: steady filtered bed plus transient clicks and low pops.
    this.vinylGain = this.gates.vinyl;
    this.vinylDustGain = new Tone.Gain(0.45).connect(this.vinylGain);
    this.vinylDustFilter = new Tone.Filter({
      frequency: 1800,
      type: 'bandpass',
      Q: 0.7,
    }).connect(this.vinylDustGain);
    this.vinyl = new Tone.Noise('pink').connect(this.vinylDustFilter);
    this.vinylClickFilter = new Tone.Filter({
      frequency: 5200,
      type: 'highpass',
      Q: 0.6,
    }).connect(this.vinylGain);
    this.vinylClick = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.02 },
      volume: -2,
    }).connect(this.vinylClickFilter);
    this.vinylPop = new Tone.MembraneSynth({
      pitchDecay: 0.035,
      octaves: 2.6,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
      volume: -7,
    }).connect(this.vinylGain);

    this._mix = params.mix;
    this._instrumentVolume = params.instrumentVolume;
    Tone.getTransport().bpm.value = params.bpm;
    Tone.getTransport().swingSubdivision = '16n';
    Tone.getTransport().swing = clamp(params.swing, 0, 1);
    this.applyVinylAmount(params.vinyl, 0);
    this.applyTape(params.tape, 0);
    this.applyCrusher(params.crush, 0);
    this.applyMix(params.mix);
    this.updateEnergyShaping(0);

    this.rebuildCache();
  }

  private attachRng(): void {
    this.rnd = createRng(this.snap.seed, this.snap);
    this.seededMode = typeof this.snap.seed === 'string' && this.snap.seed.trim().length > 0;
  }

  private mergeSnap(p: Partial<EngineParams>): void {
    this.snap = {
      ...this.snap,
      ...p,
      mix: p.mix ? { ...p.mix } : { ...this.snap.mix },
      instrumentVolume: p.instrumentVolume ? { ...p.instrumentVolume } : { ...this.snap.instrumentVolume },
      drumProb: p.drumProb ? { ...p.drumProb } : { ...this.snap.drumProb },
    };
  }

  private createChordSynth(voice: ChordVoice): ChordSynth {
    if (voice === 'wurlitzer') {
      const synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.24,
        oscillator: { type: 'fattriangle', count: 2, spread: 8 },
        envelope: { attack: 0.004, decay: 0.18, sustain: 0.38, release: 0.42 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.006, decay: 0.16, sustain: 0.16, release: 0.24 },
        volume: -4.5,
      });
      synth.maxPolyphony = 10;
      this.chordTremolo.frequency.value = 4.7;
      this.chordTremolo.depth.value = 0.16;
      return synth;
    }

    if (voice === 'muted-guitar') {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fattriangle', count: 2, spread: 4 },
        envelope: { attack: 0.001, decay: 0.075, sustain: 0.015, release: 0.08 },
        volume: -13,
      });
      synth.maxPolyphony = 8;
      this.chordTremolo.frequency.value = 2.5;
      this.chordTremolo.depth.value = 0;
      return synth;
    }

    if (voice === 'vibraphone') {
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.15, sustain: 0.02, release: 1.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.85, sustain: 0, release: 1.1 },
        volume: -13,
      });
      synth.maxPolyphony = 8;
      this.chordTremolo.frequency.value = 6.8;
      this.chordTremolo.depth.value = 0.42;
      return synth;
    }

    if (voice === 'tape-choir') {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 3, spread: 18 },
        envelope: { attack: 0.72, decay: 0.5, sustain: 0.82, release: 1.8 },
        volume: -16.5,
      });
      synth.maxPolyphony = 8;
      this.chordTremolo.frequency.value = 0.46;
      this.chordTremolo.depth.value = 0.12;
      return synth;
    }

    if (voice === 'juno-strings') {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
        envelope: { attack: 0.24, decay: 0.42, sustain: 0.58, release: 1.15 },
        volume: -18,
      });
      synth.maxPolyphony = 8;
      this.chordTremolo.frequency.value = 0.82;
      this.chordTremolo.depth.value = 0.18;
      return synth;
    }

    if (voice === 'organ') {
      const synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: 'square' },
        envelope: { attack: 0.003, decay: 0.02, sustain: 0.98, release: 0.12 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.03, sustain: 0.55, release: 0.08 },
        volume: -16,
      });
      synth.maxPolyphony = 10;
      this.chordTremolo.frequency.value = 6.7;
      this.chordTremolo.depth.value = 0.48;
      return synth;
    }

    if (voice === 'glass-pad') {
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 7.01,
        modulationIndex: 12,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.006, decay: 1.15, sustain: 0.015, release: 1.45 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.85, sustain: 0, release: 1.1 },
        volume: -21,
      });
      synth.maxPolyphony = 8;
      this.chordTremolo.frequency.value = 7.8;
      this.chordTremolo.depth.value = 0.08;
      return synth;
    }

    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.45, release: 1.2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.1, release: 1.0 },
      volume: -12,
    });
    synth.maxPolyphony = 6;
    this.chordTremolo.frequency.value = 4;
    this.chordTremolo.depth.value = 0.3;
    return synth;
  }

  private applyChordVoice(voice: ChordVoice): void {
    this.currentChordVoice = voice;
    this.chordSynth.releaseAll();
    this.guitarSampler.releaseAll();
    this.chordSynth.dispose();
    this.chordSynth = this.createChordSynth(voice);
    this.chordSynth.connect(this.chordTremolo);
  }

  private restartSequenceFromBeginning(): void {
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.resetComposition();
    this.generateMelodyPattern();
    this.scheduleSequence().start(0);
    Tone.getTransport().start();
  }

  private _vinylLevel = 0.01;
  private _mix: EngineParams['mix'];
  private _instrumentVolume: EngineParams['instrumentVolume'];
  private activeMix!: InstrumentMix;

  private applyVinylAmount(amount: number, rampTime = 0.2): void {
    const vinyl = clamp(amount, 0, 1);
    this._vinylLevel = vinyl * 0.055;
    this.vinylDustGain.gain.rampTo(0.18 + vinyl * 0.32, rampTime);
    this.vinylDustFilter.frequency.rampTo(1100 + vinyl * 2400, rampTime);
    if (this.effectiveMix().vinyl) this.vinylGain.gain.rampTo(this._vinylLevel * this._instrumentVolume.vinyl, rampTime);
  }

  private tickVinyl(time: number, step: number): void {
    const amount = clamp(this.snap.vinyl, 0, 1);
    if (amount <= 0 || !this._mix.vinyl) return;

    const dustChance = 0.1 + amount * 0.24;
    const popChance = 0.08 + amount * 0.16;
    const dropoutChance = 0.025 + amount * 0.07;

    if (this.rnd() < dustChance) {
      const vel = 0.28 + amount * 0.34 + this.rnd() * 0.22;
      this.vinylClick.triggerAttackRelease('64n', time + this.rnd() * 0.012, vel);
    }

    if ((step === 0 || step === this.cachedBassHalfStep) && this.rnd() < popChance) {
      const note = this.rnd() < 0.5 ? 'C2' : 'F1';
      this.vinylPop.triggerAttackRelease(note, '16n', time + this.rnd() * 0.018, 0.55 + amount * 0.28);
    }

    if (step % this.cachedBassQuarterStep === 0 && this.rnd() < dropoutChance) {
      const dip = 0.12 + this.rnd() * 0.18;
      const recoverAt = time + 0.045 + this.rnd() * 0.08;
      this.vinylDustGain.gain.setValueAtTime(this.vinylDustGain.gain.value, time);
      this.vinylDustGain.gain.linearRampToValueAtTime(dip, time + 0.012);
      this.vinylDustGain.gain.linearRampToValueAtTime(0.18 + amount * 0.32, recoverAt);
    }
  }

  private rebuildCache(): void {
    this.cachedProg = getReharmonizedProgression(this.currentProgressionId, this.currentReharmFlavor);
    this.cachedPattern = getPattern(this.currentMood, this.currentTimeSignature);
    this.currentStepsPerBar = this.cachedPattern.stepsPerBar;
    this.ensurePatternBuffers();
    this.cachedChordStepSet = new Set(this.cachedPattern.chordSteps);
    this.cachedBassStepToInterval = new Map(
      this.cachedPattern.bassSteps.map(b => [b.step, b.interval])
    );
    const chordSemi = this.currentOctaveShift * 12 + this.currentKeyShift;
    const chordNotes = this.cachedProg.chords.map(chord =>
      chord.notes.map(n => this.transpose(n, chordSemi))
    );
    this.cachedChordNotes = this.currentVoiceLeading ? this.voiceLeadChords(chordNotes) : chordNotes;
    this.cachedMutedGuitarUpNotes = this.cachedChordNotes.map(chord => [...chord].reverse());
    this.cachedTapeChoirNotes = this.cachedChordNotes.map(chord =>
      chord.map((note, i) => this.transpose(note, i === chord.length - 1 ? -12 : 0))
    );
    this.cachedOrganNotes = this.cachedChordNotes.map(chord => chord.slice(0, 3));
    this.cachedGlassPadNotes = this.cachedChordNotes.map(chord => [
      ...chord.map(note => this.transpose(note, 12)),
      this.transpose(chord[chord.length - 1], 24),
    ]);
    this.cachedBassRoots = this.cachedProg.bassRoots.map(n => this.transpose(n, this.currentKeyShift));
    this.cachedBassThirds = this.cachedProg.bassThirds.map(n => this.transpose(n, this.currentKeyShift));
    this.cachedBassFifths = this.cachedProg.bassFifths.map(n => this.transpose(n, this.currentKeyShift));
    this.cachedBassOctaves = this.cachedProg.bassRoots.map(n => this.transpose(n, this.currentKeyShift + 12));
    // Approach note = 1 semitone below each chord's (already key-shifted) root
    this.cachedBassApproach = this.cachedBassRoots.map(n => this.transpose(n, -1));
    this.cachedBassQuarterStep = Math.floor(this.currentStepsPerBar / 4);
    this.cachedBassHalfStep = Math.floor(this.currentStepsPerBar / 2);
    this.cachedBassThreeQuarterStep = Math.floor((this.currentStepsPerBar * 3) / 4);
    this.cachedBassPickupStep = Math.max(0, this.currentStepsPerBar - 2);
    const melSemi = this.currentMelodyOctave * 12 + this.currentKeyShift;
    const baseMelodyNotes = this.cachedProg.melodyNotes.map(n => this.transpose(n, melSemi));
    const baseMelodyMidi = baseMelodyNotes.map(n => this.noteToMidi(n));
    const targetMelodyMidi =
      baseMelodyMidi.length > 0
        ? baseMelodyMidi.reduce((sum, midi) => sum + midi, 0) / baseMelodyMidi.length
        : 72 + this.currentMelodyOctave * 12 + this.currentKeyShift;
    const melodyNoteSet = new Set(baseMelodyNotes);
    this.cachedProg.chords.forEach((chord, i) => {
      const harmonicNotes = [
        ...chord.notes.map(n => this.transpose(n, this.currentKeyShift)),
        this.cachedBassRoots[i],
        this.cachedBassThirds[i],
        this.cachedBassFifths[i],
      ];
      harmonicNotes.forEach(note => {
        melodyNoteSet.add(this.noteNearMidi(note, targetMelodyMidi));
      });
    });
    this.cachedMelodyNotes = [...melodyNoteSet];
    this.cachedMelodyFreqs = this.cachedMelodyNotes.map(n => Tone.Frequency(n).toFrequency());

    // Sort once per cache rebuild — the bar-loop just reads it.
    this.cachedSortedMelodyIdx = Array.from({ length: this.cachedMelodyNotes.length }, (_, i) => i)
      .sort((a, b) => this.cachedMelodyFreqs[a] - this.cachedMelodyFreqs[b]);

    // For each chord, find which positions in the sorted pool are chord tones
    // (pitch class matches a chord pitch class). Used for resolution + counter.
    const sortedPCs = this.cachedSortedMelodyIdx.map(idx => this.pitchClass(this.cachedMelodyNotes[idx]));
    this.cachedChordTonePos = this.cachedChordNotes.map((chord, i) => {
      const chordPCs = new Set([
        ...chord.map(n => this.pitchClass(n)),
        this.pitchClass(this.cachedBassRoots[i]),
        this.pitchClass(this.cachedBassThirds[i]),
        this.pitchClass(this.cachedBassFifths[i]),
      ]);
      const out: number[] = [];
      for (let p = 0; p < sortedPCs.length; p++) {
        if (chordPCs.has(sortedPCs[p])) out.push(p);
      }
      // Fallback: if pool has no chord tones for this chord, treat all as resolvable.
      return out.length > 0 ? out : Array.from({ length: sortedPCs.length }, (_, p) => p);
    });
  }

  private ensurePatternBuffers(): void {
    if (this.melodyPatternBuf.length === this.currentStepsPerBar) return;
    this.melodyPatternBuf = new Array(this.currentStepsPerBar).fill(null);
    this.counterPatternBuf = new Array(this.currentStepsPerBar).fill(null);
  }

  private scheduleSequence(): Tone.Sequence<number> {
    const sequence = new Tone.Sequence(
      (time, step) => {
        this.currentStep = step as number;
        this.tick(time, step as number);
      },
      Array.from({ length: this.currentStepsPerBar }, (_, i) => i),
      '16n'
    );
    this.sequence = sequence;
    return sequence;
  }

  private applyMix(mix: EngineParams['mix']): void {
    this.activeMix = mix;
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'counter'] as const).forEach(k => {
      this.gates[k].gain.rampTo(mix[k] ? this._instrumentVolume[k] : 0, 0.02);
    });
    this.gates.vinyl.gain.rampTo(mix.vinyl ? this._vinylLevel * this._instrumentVolume.vinyl : 0, 0.05);
  }

  private triggerSidechain(time: number, intensity = 1): void {
    if (!this.currentSidechainDucking) return;

    const amount = clamp(intensity, 0, 1);
    const attackAt = time + SIDECHAIN_ATTACK_SECONDS;
    const releaseAt = attackAt + SIDECHAIN_RELEASE_SECONDS;
    const chordFloor = 1 - (1 - SIDECHAIN_CHORD_FLOOR) * amount;
    const bassFloor = 1 - (1 - SIDECHAIN_BASS_FLOOR) * amount;

    this.chordSidechain.gain.cancelAndHoldAtTime(time);
    this.chordSidechain.gain.linearRampToValueAtTime(chordFloor, attackAt);
    this.chordSidechain.gain.exponentialRampToValueAtTime(1, releaseAt);

    this.bassSidechain.gain.cancelAndHoldAtTime(time);
    this.bassSidechain.gain.linearRampToValueAtTime(bassFloor, attackAt);
    this.bassSidechain.gain.exponentialRampToValueAtTime(1, releaseAt);
  }

  private resetSidechain(time = Tone.now(), rampTime = 0.04): void {
    const endAt = time + rampTime;
    this.chordSidechain.gain.cancelAndHoldAtTime(time);
    this.chordSidechain.gain.linearRampToValueAtTime(1, endAt);
    this.bassSidechain.gain.cancelAndHoldAtTime(time);
    this.bassSidechain.gain.linearRampToValueAtTime(1, endAt);
  }

  private applyTape(amount: number, rampTime = 0.2): void {
    const tape = Math.max(0, Math.min(1, amount));
    this.tapeSaturation.distortion = tape * 0.28;
    this.tapeSaturation.wet.rampTo(tape * 0.55, rampTime);
    this.tapeWow.wet.rampTo(tape, rampTime);
    this.tapeWow.depth.rampTo(tape * 0.38, rampTime);
    this.tapeFlutter.wet.rampTo(tape * 0.9, rampTime);
    this.tapeFlutter.depth.rampTo(tape * 0.2, rampTime);
    this.tapeTremble.wet.rampTo(tape * 0.45, rampTime);
    this.tapeTremble.depth.rampTo(tape * 0.18, rampTime);
  }

  private applyCrusher(amount: number, rampTime = 0.08): void {
    const crush = clamp(amount, 0, 1);
    const bits = 16 - crush * 12;
    this.bitCrusher.bits.rampTo(bits, rampTime);
    this.bitCrusher.wet.rampTo(crush * 0.9, rampTime);
  }

  private updateEnergyShaping(rampTime = 0.25): void {
    const sec = this.songFormEnabled ? SONG_ARRANGEMENT[this.sectionIdx] : null;
    const userEnergy = clamp(this.currentEnergy / 100, 0, 1);
    const sectionTarget = sec?.energy ?? 1;
    const fillLift = this.isFillBar ? 0.18 : 0;
    const energy = clamp(sectionTarget * (0.45 + userEnergy * 0.55) + fillLift, 0, 1.15);
    const density = (sec?.drumDensity ?? 1) * (0.45 + energy * 0.75);

    this.activeEnergy = energy;
    this.activeKickScale = clamp(density * (0.75 + energy * 0.35), 0, 1.25);
    this.activeSnareScale = clamp(density * (0.7 + energy * 0.4), 0, 1.2);
    this.activeHihatScale = clamp(density * (0.45 + energy * 0.75), 0, 1.3);
    this.activeMelodyChance = clamp(0.46 + energy * 0.4, 0.34, 0.9);

    const filterTilt = sec?.filterTilt ?? 1;
    const highCut = clamp(this.baseHighCut * filterTilt * (0.58 + energy * 0.5), 500, 18000);
    const lowCut = clamp(this.baseLowCut + (1 - Math.min(energy, 1)) * 22, 20, 500);
    this.lowpass.frequency.rampTo(highCut, rampTime);
    this.highpass.frequency.rampTo(lowCut, rampTime);
  }

  // Combines the user's mix with the active section's mute overrides. On a
  // fill bar the muted instruments come back so the fill is audible.
  private effectiveMix(): InstrumentMix {
    if (!this.songFormEnabled) return this._mix;
    const sec = SONG_ARRANGEMENT[this.sectionIdx];
    if (!sec.mutes || sec.mutes.length === 0 || this.isFillBar) return this._mix;
    const eff = { ...this._mix };
    for (const k of sec.mutes) eff[k] = false;
    // The counter line is musical accompaniment to the melody — if a section
    // mutes the lead, mute its harmony too so the texture reads as intended.
    if (sec.mutes.includes('melody')) eff.counter = false;
    return eff;
  }

  private applyEffectiveMix(): void {
    this.applyMix(this.effectiveMix());
  }

  private resetComposition(): void {
    this.currentStep = 0;
    this.chordIndex = this.cachedProg.chords.length - 1;
    this.prevMelodyNote = null;
    this.theme = null;
    this.themeCycleAge = 0;
    this.themeMaxCycles = 0;
    this.lastThemeChordIndex = -1;
    this.currentBar = 0;
    this.updateSection();
    this.applyEffectiveMix();
  }

  private updateSection(): void {
    if (!this.songFormEnabled) {
      this.sectionIdx = 0;
      this.barInSection = 0;
      this.isFillBar = false;
      return;
    }
    const { index, barInSection } = locateSection(this.currentBar);
    this.sectionIdx = index;
    this.barInSection = barInSection;
    const sec = SONG_ARRANGEMENT[index];
    this.isFillBar = !!sec.fillOnLastBar && barInSection === sec.bars - 1;
    this.updateEnergyShaping();
  }

  private transpose(note: string, semitones: number): string {
    if (semitones === 0) return note;
    return Tone.Frequency(note).transpose(semitones).toNote() as string;
  }

  private midiToNote(midi: number): string {
    return Tone.Frequency(midi, 'midi').toNote() as string;
  }

  private noteToMidi(note: string): number {
    return Tone.Frequency(note).toMidi() as number;
  }

  private pitchClass(note: string): number {
    return ((this.noteToMidi(note) % 12) + 12) % 12;
  }

  private noteNearMidi(note: string, targetMidi: number): string {
    let midi = this.noteToMidi(note);
    while (midi - targetMidi > 6) midi -= 12;
    while (targetMidi - midi > 6) midi += 12;
    return this.midiToNote(midi);
  }

  private chordMovementScore(candidate: number[], previous: number[] | null, baseCenter: number): number {
    const span = candidate[candidate.length - 1] - candidate[0];
    const center = candidate.reduce((sum, midi) => sum + midi, 0) / candidate.length;
    if (!previous) return span * 2 + Math.abs(center - baseCenter);

    let movement = 0;
    for (let i = 0; i < candidate.length; i++) {
      movement += Math.abs(candidate[i] - previous[i]);
    }
    const prevCenter = previous.reduce((sum, midi) => sum + midi, 0) / previous.length;
    return movement + span * 0.35 + Math.abs(center - prevCenter) * 0.3;
  }

  private closeInversionFor(notes: string[], previous: number[] | null): number[] {
    const base: number[] = notes.map(note => Tone.Frequency(note).toMidi() as number).sort((a, b) => a - b);
    const baseCenter = base.reduce((sum, midi) => sum + midi, 0) / base.length;
    const candidates: number[][] = [];
    const seen = new Set<string>();

    const build = (i: number, midiNotes: number[]) => {
      if (i === base.length) {
        const candidate = [...midiNotes].sort((a, b) => a - b);
        const key = candidate.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        const span = candidate[candidate.length - 1] - candidate[0];
        if (span <= 19) candidates.push(candidate);
        return;
      }

      for (let octave = -2; octave <= 2; octave++) {
        midiNotes.push(base[i] + octave * 12);
        build(i + 1, midiNotes);
        midiNotes.pop();
      }
    };

    build(0, []);
    const pool = candidates.length > 0 ? candidates : [base];
    let best = pool[0];
    let bestScore = this.chordMovementScore(best, previous, baseCenter);
    for (let i = 1; i < pool.length; i++) {
      const score = this.chordMovementScore(pool[i], previous, baseCenter);
      if (score < bestScore) {
        best = pool[i];
        bestScore = score;
      }
    }
    return best;
  }

  private voiceLeadChords(chords: string[][]): string[][] {
    let previous: number[] | null = null;
    return chords.map(chord => {
      const midiChord = this.closeInversionFor(chord, previous);
      previous = midiChord;
      return midiChord.map(midi => this.midiToNote(midi));
    });
  }

  private motifWith(
    deltas: number[],
    durs: MelodyDur[],
    startStep: number,
    anchorOffset: number
  ): Motif {
    return {
      deltas,
      durs,
      startStep: Math.min(startStep, Math.max(0, this.currentStepsPerBar - 6)),
      anchorOffset,
    };
  }

  // Builds a fresh theme: a small call/answer phrase mapped across the whole
  // progression. Each chord slot keeps its rhythmic identity and contour, so
  // the listener hears an actual hook before variations begin.
  private generateTheme(): Motif[] {
    const templates = [
      {
        call: [0, 1, 2, 1],
        answer: [0, -1, 0, 2],
        lift: [0, 1, 3, 2],
        cadence: [1, 0, -1, 0],
        durs: ['8n', '8n', '4n', '4n'] as MelodyDur[],
        answerDurs: ['4n', '8n', '8n', '2n'] as MelodyDur[],
        cadenceDurs: ['8n', '8n', '4n', '2n'] as MelodyDur[],
        offsets: [0, 0, 1, -1],
        starts: [0, 2, 0, 0],
      },
      {
        call: [0, 2, 1, 0],
        answer: [0, 1, -1, 0],
        lift: [0, 2, 3, 1],
        cadence: [0, -2, -1, 0],
        durs: ['4n', '8n', '8n', '4n'] as MelodyDur[],
        answerDurs: ['8n', '8n', '4n', '2n'] as MelodyDur[],
        cadenceDurs: ['4n', '8n', '8n', '2n'] as MelodyDur[],
        offsets: [0, 1, 1, -1],
        starts: [0, 0, 2, 0],
      },
      {
        call: [0, -1, 1, 2],
        answer: [0, 1, 0, -1],
        lift: [0, 1, 2, 3],
        cadence: [2, 1, -1, 0],
        durs: ['8n', '4n', '8n', '4n'] as MelodyDur[],
        answerDurs: ['4n', '4n', '8n', '2n'] as MelodyDur[],
        cadenceDurs: ['8n', '8n', '4n', '2n'] as MelodyDur[],
        offsets: [0, -1, 1, 0],
        starts: [0, 2, 0, 0],
      },
    ];
    const t = templates[Math.floor(this.rnd() * templates.length)] ?? templates[0];
    const chordCount = this.cachedProg.chords.length;
    const theme: Motif[] = [];

    for (let i = 0; i < chordCount; i++) {
      const phrasePos = i % 4;
      const isCadence = i === chordCount - 1;
      const deltas = isCadence
        ? t.cadence
        : phrasePos === 2
          ? t.lift
          : phrasePos === 1
            ? t.answer
            : t.call;
      const durs = isCadence
        ? t.cadenceDurs
        : phrasePos === 1
          ? t.answerDurs
          : t.durs;
      theme.push(this.motifWith(
        deltas,
        durs,
        t.starts[phrasePos] ?? 0,
        t.offsets[phrasePos] ?? 0
      ));
    }

    return theme;
  }

  private ensureThemeForCurrentChord(): void {
    const wrapped = this.lastThemeChordIndex >= 0 && this.chordIndex < this.lastThemeChordIndex;
    if (wrapped) this.themeCycleAge++;

    if (!this.theme || (wrapped && this.themeCycleAge >= this.themeMaxCycles)) {
      this.theme = this.generateTheme();
      this.themeCycleAge = 0;
      this.themeMaxCycles = 2 + Math.floor(this.rnd() * 3); // 2–4 full progression cycles
    }

    this.lastThemeChordIndex = this.chordIndex;
  }

  // Snap a sorted-pool position to the nearest chord tone for the current chord.
  private nearestChordTonePos(pos: number, chordTonePos: number[]): number {
    let best = chordTonePos[0];
    let bestDist = Math.abs(best - pos);
    for (let i = 1; i < chordTonePos.length; i++) {
      const d = Math.abs(chordTonePos[i] - pos);
      if (d < bestDist) { bestDist = d; best = chordTonePos[i]; }
    }
    return best;
  }

  // Picks a chord tone below the lead — preferring a third (≈2 pool steps down)
  // and falling back to a sixth — so the harmony reads as a third or sixth.
  // Returns -1 if no chord tone sits below the lead.
  private findCounterPos(leadPos: number, chordTonePos: number[], preferredStepsDown = 2): number {
    const target = leadPos - preferredStepsDown;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < chordTonePos.length; i++) {
      const ctp = chordTonePos[i];
      if (ctp >= leadPos) continue;
      const d = Math.abs(ctp - target);
      if (d < bestDist) { bestDist = d; best = ctp; }
    }
    return best;
  }

  private placeCounterHit(step: number, leadPos: number, chordTonePos: number[], dur: MelodyDur, preferredStepsDown = 2): void {
    if (step < 0 || step >= this.currentStepsPerBar || this.counterPatternBuf[step] !== null) return;

    const cPos = this.findCounterPos(leadPos, chordTonePos, preferredStepsDown);
    if (cPos >= 0) {
      this.counterPatternBuf[step] = {
        note: this.cachedMelodyNotes[this.cachedSortedMelodyIdx[cPos]],
        dur,
      };
    }
  }

  // Renders the active theme cell into the melody (and counter) buffers for this bar.
  // Theme lifecycle: a fresh call/answer phrase spans the progression, repeats
  // verbatim once, then gets light contour/rhythm variations before being replaced.
  // Anchor position tracks the previous bar's last note so phrases connect
  // smoothly, and strong notes snap to chord tones for tension/release.
  private generateMelodyPattern(): void {
    this.melodyPatternBuf.fill(null);
    this.counterPatternBuf.fill(null);

    const sorted = this.cachedSortedMelodyIdx;
    const poolLen = sorted.length;
    if (poolLen === 0) return;

    const chordTonePos = this.cachedChordTonePos[this.chordIndex];

    this.ensureThemeForCurrentChord();
    const motif = this.theme?.[this.chordIndex] ?? this.generateTheme()[0];

    // Anchor: nearest pool position to where the previous bar left off, so the
    // motif rides naturally on top of the changing chord. On the very first
    // bar, anchor near a chord tone so the opening note feels grounded.
    let anchor: number;
    if (this.prevMelodyNote) {
      const prevFreq = Tone.Frequency(this.prevMelodyNote).toFrequency();
      let best = 0;
      let bestDist = Math.abs(this.cachedMelodyFreqs[sorted[0]] - prevFreq);
      for (let p = 1; p < poolLen; p++) {
        const d = Math.abs(this.cachedMelodyFreqs[sorted[p]] - prevFreq);
        if (d < bestDist) { bestDist = d; best = p; }
      }
      anchor = this.nearestChordTonePos(best, chordTonePos);
    } else {
      anchor = chordTonePos[Math.floor(chordTonePos.length / 2)] ?? Math.floor(poolLen / 2);
    }
    anchor = this.nearestChordTonePos(
      Math.max(0, Math.min(poolLen - 1, anchor + motif.anchorOffset)),
      chordTonePos
    );

    // Variations happen after a full cycle, preserving the hook while preventing
    // the phrase from becoming a hard loop.
    let workingDeltas = motif.deltas;
    if (this.themeCycleAge >= 2 && this.chordIndex % 2 === 1 && this.rnd() < 0.42) {
      workingDeltas = motif.deltas.map((d, i) => i === 0 ? d : -d);
    } else if (this.themeCycleAge >= 1 && this.rnd() < 0.36) {
      workingDeltas = motif.deltas.map((d, i) =>
        i === 0 ? d : d + (this.rnd() < 0.5 ? 1 : -1)
      );
    }

    let step = motif.startStep;
    const lastIdx = workingDeltas.length - 1;
    for (let i = 0; i < workingDeltas.length; i++) {
      if (step >= this.currentStepsPerBar) break;

      let pos = Math.max(0, Math.min(poolLen - 1, anchor + workingDeltas[i]));
      const dur = motif.durs[i];
      // Tension/release: starts, longer notes, and strong pulses land on chord
      // tones. Short inner notes may pass between them for a lo-fi/jazz lean.
      if (i === 0 || i === lastIdx || dur !== '8n' || step % this.cachedBassQuarterStep === 0) {
        pos = this.nearestChordTonePos(pos, chordTonePos);
      }

      const note = this.cachedMelodyNotes[sorted[pos]];
      this.melodyPatternBuf[step] = { note, dur };

      // Counter line: harmonize structural notes, then answer in nearby rests.
      // That keeps it tied to the theme without merely doubling the lead.
      if (dur !== '8n' && (i === 0 || i === lastIdx || this.activeEnergy < 0.82)) {
        this.placeCounterHit(step, pos, chordTonePos, dur === '2n' ? '4n' : dur, 2);
      }
      const answerStep = step + (dur === '2n' ? 4 : 2);
      const answerPos = Math.max(0, Math.min(poolLen - 1, pos + (i % 2 === 0 ? -1 : 1)));
      if (
        answerStep < this.currentStepsPerBar &&
        this.melodyPatternBuf[answerStep] === null &&
        (i === 1 || i === lastIdx || this.activeEnergy > 0.62)
      ) {
        this.placeCounterHit(answerStep, answerPos, chordTonePos, '8n', 3);
      }

      step += dur === '2n' ? 8 : dur === '4n' ? 4 : 2;
    }
  }

  async start(): Promise<void> {
    this.attachRng();
    await this.reverb.ready;
    await Tone.start();
    this.vinyl.start();
    this.resetComposition();
    this.generateMelodyPattern();

    this.scheduleSequence().start(0);
    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.vinyl.stop();
    this.chordSynth.releaseAll();
    this.guitarSampler.releaseAll();
  }

  // tick() is called on every 16th note step. It must not allocate — all data comes from caches.
  private tick(time: number, step: number): void {
    if (step === 0) {
      this.chordIndex = (this.chordIndex + 1) % this.cachedProg.chords.length;
      this.generateMelodyPattern();
      if (this.songFormEnabled) {
        this.currentBar++;
        const prevSection = this.sectionIdx;
        const prevFill = this.isFillBar;
        this.updateSection();
        if (this.sectionIdx !== prevSection || this.isFillBar !== prevFill) {
          this.applyEffectiveMix();
        }
      }
    }

    const shiftedNotes = this.cachedChordNotes[this.chordIndex];

    if (this.activeMix.kick && this.cachedPattern.kick[step] && this.rnd() < this.currentDrumProb.kick * this.activeKickScale) {
      this.kick.triggerAttackRelease('C1', '8n', time);
      this.triggerSidechain(time);
    }

    if (this.activeMix.snare && this.cachedPattern.snare[step] && this.rnd() < this.currentDrumProb.snare * this.activeSnareScale) {
      this.snare.triggerAttackRelease('8n', time);
    }

    if (this.activeMix.hihat && this.cachedPattern.hihat[step] && this.rnd() < this.currentDrumProb.hihat * this.activeHihatScale) {
      this.hihat.triggerAttackRelease('32n', time, 0.5 + this.activeEnergy * 0.18 + this.rnd() * 0.12);
    }

    // Snare-roll fill on the last beat group of a fill bar, telegraphing the next section.
    if (this.activeMix.snare && this.isFillBar && step >= this.cachedPattern.fillStartStep) {
      const vel = 0.32 + (step - this.cachedPattern.fillStartStep) * 0.16;
      this.snare.triggerAttackRelease('16n', time, vel);
      if (this.activeMix.kick && step === this.cachedPattern.fillStartStep) {
        this.kick.triggerAttackRelease('C1', '16n', time, 0.6);
        this.triggerSidechain(time, 0.75);
      }
    }

    if (this.activeMix.chord && this.cachedChordStepSet.has(step)) {
      const jitter = this.rnd() * this.currentChordTiming * 0.12;
      const chordTime = time + jitter;
      if (this.currentChordVoice === 'muted-guitar') {
        const dur = Math.min(this.currentChordLength, 0.16);
        const strumDown = this.rnd() < 0.78;
        const notes = strumDown ? shiftedNotes : this.cachedMutedGuitarUpNotes[this.chordIndex];
        if (this.guitarSampler.loaded) {
          notes.forEach((note, i) => {
            const accent = i === 0 ? 0.72 : 0.5;
            this.guitarSampler.triggerAttackRelease(note, dur, chordTime + i * 0.019, accent + this.rnd() * 0.08);
          });
        } else {
          notes.forEach((note, i) => {
            const accent = i === 0 ? 0.56 : 0.38;
            this.chordSynth.triggerAttackRelease(note, dur, chordTime + i * 0.018, accent + this.rnd() * 0.08);
          });
        }
      } else if (this.currentChordVoice === 'wurlitzer') {
        this.chordSynth.triggerAttackRelease(shiftedNotes, Math.min(this.currentChordLength, 0.88), chordTime, 0.76 + this.rnd() * 0.08);
      } else if (this.currentChordVoice === 'vibraphone') {
        this.chordSynth.triggerAttackRelease(shiftedNotes, Math.max(0.8, Math.min(this.currentChordLength, 1.8)), chordTime, 0.54 + this.rnd() * 0.08);
      } else if (this.currentChordVoice === 'tape-choir') {
        this.chordSynth.triggerAttackRelease(this.cachedTapeChoirNotes[this.chordIndex], Math.max(1.4, Math.min(this.currentChordLength + 0.45, 2.0)), chordTime, 0.4 + this.rnd() * 0.05);
      } else if (this.currentChordVoice === 'juno-strings') {
        this.chordSynth.triggerAttackRelease(shiftedNotes, Math.max(0.9, Math.min(this.currentChordLength + 0.2, 1.6)), chordTime, 0.42 + this.rnd() * 0.06);
      } else if (this.currentChordVoice === 'organ') {
        this.chordSynth.triggerAttackRelease(this.cachedOrganNotes[this.chordIndex], Math.min(this.currentChordLength, 0.72), chordTime, 0.62 + this.rnd() * 0.06);
      } else if (this.currentChordVoice === 'glass-pad') {
        this.chordSynth.triggerAttackRelease(this.cachedGlassPadNotes[this.chordIndex], Math.max(0.75, Math.min(this.currentChordLength, 1.1)), chordTime, 0.36 + this.rnd() * 0.05);
      } else {
        this.chordSynth.triggerAttackRelease(shiftedNotes, this.currentChordLength, chordTime, 0.5 + this.rnd() * 0.1);
      }
    }

    if (this.activeMix.bass && this.currentBassStyle === 'walking') {
      const walkPos = this.cachedPattern.walkingSteps.indexOf(step);
      if (walkPos >= 0) {
        let bassNote: string;
        if (walkPos === 0) bassNote = this.cachedBassRoots[this.chordIndex];
        else if (walkPos === 1) bassNote = this.cachedBassThirds[this.chordIndex];
        else if (walkPos === 2) bassNote = this.cachedBassFifths[this.chordIndex];
        else bassNote = this.cachedBassApproach[(this.chordIndex + 1) % this.cachedProg.chords.length];
        this.bassSynth.triggerAttackRelease(bassNote, '4n', time, 0.75);
      }
    } else if (this.activeMix.bass && this.currentBassStyle === 'lazy') {
      const lazyPos = this.cachedPattern.lazySteps.indexOf(step);
      if (lazyPos === 0) {
        // Long sustained root on the downbeat
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '2n', time, 0.7);
      } else if (lazyPos === 1) {
        // Syncopated fifth, dragged feel via small late jitter
        const drag = this.rnd() * 0.02;
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '4n', time + drag, 0.6);
      }
    } else if (this.activeMix.bass && this.currentBassStyle === 'bounce') {
      if (step === 0) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '8n', time, 0.75);
      } else if (step === this.cachedBassQuarterStep || step === this.cachedBassThreeQuarterStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '16n', time, 0.58);
      } else if (step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassOctaves[this.chordIndex], '8n', time, 0.65);
      }
    } else if (this.activeMix.bass && this.currentBassStyle === 'dub') {
      if (step === 0) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '2n', time, 0.72);
      } else if (step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '4n', time, 0.5);
      } else if (step === this.cachedBassPickupStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassApproach[(this.chordIndex + 1) % this.cachedProg.chords.length], '8n', time, 0.55);
      }
    } else if (this.activeMix.bass && this.currentBassStyle === 'pedal') {
      if (step === 0 || step === this.cachedBassQuarterStep || step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '8n', time, 0.62);
      } else if (step === this.cachedBassThreeQuarterStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '8n', time, 0.6);
      }
    } else if (this.activeMix.bass) {
      const interval = this.cachedBassStepToInterval.get(step);
      if (interval !== undefined) {
        const raw = interval === 0 ? this.cachedBassRoots[this.chordIndex] : this.cachedBassFifths[this.chordIndex];
        this.bassSynth.triggerAttackRelease(raw, '8n', time, 0.7);
      }
    }

    const melHit = this.melodyPatternBuf[step];
    const counterHit = this.counterPatternBuf[step];
    if (melHit !== null || counterHit !== null) {
      const jitter = this.rnd() * this.currentChordTiming * 0.08;
      let melodyFired = false;

      if (this.activeMix.melody && melHit !== null && this.rnd() < this.activeMelodyChance) {
        melodyFired = true;
        this.melodySynth.triggerAttackRelease(melHit.note, melHit.dur, time + jitter, 0.34 + this.activeEnergy * 0.18 + this.rnd() * 0.12);
        this.prevMelodyNote = melHit.note;
      }

      if (this.activeMix.counter && counterHit !== null) {
        const counterChance = melHit !== null
          ? 0.88
          : clamp(0.48 + this.activeEnergy * 0.25, 0.42, 0.78);
        if (melodyFired || this.rnd() < counterChance) {
          const counterDelay = melHit !== null ? 0 : this.rnd() * 0.012;
          this.counterSynth.triggerAttackRelease(counterHit.note, counterHit.dur, time + jitter + counterDelay, 0.28 + this.rnd() * 0.09);
        }
      }
    }

    if (this.activeMix.vinyl) this.tickVinyl(time, step);
  }

  updateParams(params: Partial<EngineParams>): void {
    const seedTouched = params.seed !== undefined;
    this.mergeSnap(params);
    let needsRebuild = false;
    let needsSequenceRestart = false;
    let reopenedSequenceAfterRebuild = false;

    if (params.bpm !== undefined) {
      Tone.getTransport().bpm.rampTo(params.bpm, 0.1);
    }
    if (params.mood !== undefined) {
      this.currentMood = params.mood;
      needsRebuild = true;
    }
    if (params.progressionId !== undefined) {
      this.currentProgressionId = params.progressionId;
      this.chordIndex = 0;
      this.prevMelodyNote = null;
      // New progression deserves a new theme rather than carrying the old shape over.
      this.theme = null;
      this.lastThemeChordIndex = -1;
      needsRebuild = true;
    }
    if (params.reharmFlavor !== undefined) {
      this.currentReharmFlavor = params.reharmFlavor;
      this.chordIndex = 0;
      this.prevMelodyNote = null;
      this.theme = null;
      this.lastThemeChordIndex = -1;
      needsRebuild = true;
    }
    if (params.octaveShift !== undefined) {
      this.currentOctaveShift = params.octaveShift;
      needsRebuild = true;
    }
    if (params.melodyOctave !== undefined) {
      this.currentMelodyOctave = params.melodyOctave;
      needsRebuild = true;
    }
    if (params.keyShift !== undefined) {
      this.currentKeyShift = params.keyShift;
      needsRebuild = true;
    }
    if (params.chordLength !== undefined) {
      this.currentChordLength = params.chordLength;
    }
    if (params.chordTiming !== undefined) {
      this.currentChordTiming = params.chordTiming;
    }
    if (params.sidechainDucking !== undefined) {
      this.currentSidechainDucking = params.sidechainDucking;
      if (!params.sidechainDucking) this.resetSidechain();
    }
    if (params.chordVoice !== undefined && params.chordVoice !== this.currentChordVoice) {
      this.applyChordVoice(params.chordVoice);
    }
    if (params.voiceLeading !== undefined && params.voiceLeading !== this.currentVoiceLeading) {
      this.currentVoiceLeading = params.voiceLeading;
      needsRebuild = true;
    }
    if (params.swing !== undefined) {
      Tone.getTransport().swingSubdivision = '16n';
      Tone.getTransport().swing = clamp(params.swing, 0, 1);
    }
    if (params.drumProb !== undefined) {
      this.currentDrumProb = { ...params.drumProb };
    }
    if (params.energy !== undefined) {
      this.currentEnergy = params.energy;
      this.updateEnergyShaping();
    }
    if (params.masterVolume !== undefined) {
      this.masterVolume.gain.rampTo(clamp(params.masterVolume, 0, 2), 0.05);
    }
    if (params.reverb !== undefined) {
      this.reverbSend.gain.rampTo(clamp(params.reverb, 0, 1) * REVERB_SEND_GAIN, 0.2);
    }
    if (params.vinyl !== undefined) {
      this.applyVinylAmount(params.vinyl);
    }
    if (params.tape !== undefined) {
      this.applyTape(params.tape);
    }
    if (params.crush !== undefined) {
      this.applyCrusher(params.crush);
    }
    if (params.lowCut !== undefined) {
      this.baseLowCut = params.lowCut;
      this.updateEnergyShaping(0.1);
    }
    if (params.highCut !== undefined) {
      this.baseHighCut = params.highCut;
      this.updateEnergyShaping(0.1);
    }
    if (params.mix !== undefined) {
      this._mix = params.mix;
      this.applyEffectiveMix();
    }
    if (params.instrumentVolume !== undefined) {
      this._instrumentVolume = params.instrumentVolume;
      this.applyEffectiveMix();
    }
    if (params.bassStyle !== undefined) {
      this.currentBassStyle = params.bassStyle;
    }
    if (params.timeSignature !== undefined && params.timeSignature !== this.currentTimeSignature) {
      this.currentTimeSignature = params.timeSignature;
      this.resetComposition();
      needsRebuild = true;
      needsSequenceRestart = true;
    }
    if (params.songForm !== undefined && params.songForm !== this.songFormEnabled) {
      this.songFormEnabled = params.songForm;
      if (this.songFormEnabled) this.currentBar = 0;
      this.updateSection();
      this.updateEnergyShaping();
      this.applyEffectiveMix();
    }

    if (needsRebuild) {
      this.attachRng();
      const stepsBefore = this.currentStepsPerBar;
      this.rebuildCache();
      if (this.seededMode) {
        this.resetComposition();
      } else {
        this.chordIndex = this.cachedProg.chords.length - 1;
      }
      this.generateMelodyPattern();
      const mustRestart =
        this.sequence !== null &&
        (needsSequenceRestart || stepsBefore !== this.currentStepsPerBar || this.seededMode);
      if (mustRestart) {
        reopenedSequenceAfterRebuild = true;
        const seq = this.sequence;
        if (seq) {
          Tone.getTransport().stop();
          seq.stop();
          seq.dispose();
          this.scheduleSequence().start(0);
          Tone.getTransport().start();
        }
      }
    }

    if (seedTouched && this.sequence && !reopenedSequenceAfterRebuild) {
      this.attachRng();
      this.restartSequenceFromBeginning();
    }
  }

  getStep(): number {
    return this.currentStep;
  }

  getChordIndex(): number {
    return this.chordIndex;
  }

  getSectionInfo(): SectionInfo | null {
    if (!this.songFormEnabled) return null;
    const sec = SONG_ARRANGEMENT[this.sectionIdx];
    return {
      id: sec.id,
      label: sec.label,
      index: this.sectionIdx,
      barInSection: this.barInSection,
      totalBars: sec.bars,
    };
  }

  dispose(): void {
    this.stop();
    this.chordSynth.dispose();
    this.guitarSampler.dispose();
    this.guitarFilter.dispose();
    this.chordTremolo.dispose();
    this.chordSidechain.dispose();
    this.bassSidechain.dispose();
    this.bassSynth.dispose();
    this.melodySynth.dispose();
    this.counterSynth.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.hihatFilter.dispose();
    this.vinyl.dispose();
    this.vinylDustGain.dispose();
    this.vinylDustFilter.dispose();
    this.vinylClick.dispose();
    this.vinylClickFilter.dispose();
    this.vinylPop.dispose();
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'counter', 'vinyl'] as const).forEach(k => this.gates[k].dispose());
    this.reverb.dispose();
    this.reverbSend.dispose();
    this.tapeSaturation.dispose();
    this.tapeWow.dispose();
    this.tapeFlutter.dispose();
    this.tapeTremble.dispose();
    this.bitCrusher.dispose();
    this.lowpass.dispose();
    this.highpass.dispose();
    this.limiter.dispose();
    this.masterVolume.dispose();
  }
}
