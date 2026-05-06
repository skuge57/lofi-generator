import * as Tone from 'tone';
import { getProgressionById, getPattern } from './musicTheory';
import type { EngineParams, Mood, ProgressionDef, RhythmPattern } from './types';

const STEPS = 16;
const WALKING_STEPS = [0, 4, 8, 12];

export class LofiEngine {
  private chordSynth: Tone.PolySynth<Tone.FMSynth>;
  private chordTremolo: Tone.Tremolo;
  private bassSynth: Tone.MonoSynth;
  private melodySynth: Tone.Synth;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hihat: Tone.MetalSynth;
  private vinyl: Tone.Noise;
  private vinylGain: Tone.Gain;

  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;
  private lowpass: Tone.Filter;
  private highpass: Tone.Filter;
  private gates: Record<keyof EngineParams['mix'], Tone.Gain>;

  private sequence: Tone.Sequence<number> | null = null;
  private currentMood: Mood;
  private currentProgressionId: string;
  private currentOctaveShift = 0;
  private currentMelodyOctave = 0;
  private currentChordLength = 1.5;
  private currentChordTiming = 0;
  private currentDrumProb = { kick: 1, snare: 1, hihat: 1 };
  private currentKeyShift = 0;
  private currentBassStyle: 'simple' | 'walking' = 'simple';
  private currentStep = 0;
  private chordIndex = 0;

  // Pre-computed caches — rebuilt only when params change, never in tick()
  private cachedProg!: ProgressionDef;
  private cachedPattern!: RhythmPattern;
  private cachedChordStepSet!: Set<number>;
  private cachedBassStepToInterval!: Map<number, number>;
  private cachedChordNotes!: string[][];
  private cachedBassRoots!: string[];
  private cachedBassThirds!: string[];
  private cachedBassFifths!: string[];
  private cachedBassApproach!: string[];
  private cachedMelodyNotes!: string[];
  private cachedMelodyFreqs!: number[];

  // Pre-allocated melody pattern buffer — cleared and reused each bar
  private melodyPatternBuf: ({ note: string; dur: string } | null)[] = new Array(STEPS).fill(null);
  private prevMelodyNote: string | null = null;

  constructor(params: EngineParams) {
    this.currentMood = params.mood;
    this.currentProgressionId = params.progressionId;
    this.currentOctaveShift = params.octaveShift;
    this.currentMelodyOctave = params.melodyOctave;
    this.currentChordLength = params.chordLength;
    this.currentChordTiming = params.chordTiming;
    this.currentDrumProb = { ...params.drumProb };
    this.currentKeyShift = params.keyShift;
    this.currentBassStyle = params.bassStyle;

    // Effects chain: instruments → gates → highpass → lowpass → reverb → limiter
    // Chorus removed from master bus — it processed all instruments simultaneously.
    // The chord tremolo still provides movement on the pad specifically.
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: 0.7, wet: params.reverb }).connect(this.limiter);
    this.lowpass = new Tone.Filter(params.highCut, 'lowpass').connect(this.reverb);
    this.highpass = new Tone.Filter(params.lowCut, 'highpass').connect(this.lowpass);

    const g = (on: boolean) => new Tone.Gain(on ? 1 : 0).connect(this.highpass);
    this.gates = {
      chord:  g(params.mix.chord),
      bass:   g(params.mix.bass),
      kick:   g(params.mix.kick),
      snare:  g(params.mix.snare),
      hihat:  g(params.mix.hihat),
      melody: g(params.mix.melody),
      vinyl:  new Tone.Gain(params.mix.vinyl ? params.vinyl * 0.03 : 0).connect(this.limiter),
    };

    // Rhodes chord pad: FM synth with tremolo
    // maxPolyphony 6 = 4 notes + 2 overlap slots during release (down from 8)
    this.chordSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.45, release: 1.2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0.1, release: 1.0 },
      volume: -12,
    });
    this.chordSynth.maxPolyphony = 6;
    this.chordTremolo = new Tone.Tremolo(4, 0.3).connect(this.gates.chord).start();
    this.chordSynth.connect(this.chordTremolo);

    // Bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { frequency: 300, type: 'lowpass' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.8 },
      volume: -10,
    }).connect(this.gates.bass);

    // Melody — soft sine lead
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.55, release: 1.4 },
      volume: -18,
    }).connect(this.gates.melody);

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
    this.hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -22,
    }).connect(this.gates.hihat);
    this.hihat.frequency.value = 400;

    // Vinyl crackle — routed through gates.vinyl directly
    this.vinylGain = this.gates.vinyl;
    this.vinyl = new Tone.Noise('pink').connect(this.vinylGain);

    Tone.getTransport().bpm.value = params.bpm;
    this._vinylLevel = params.vinyl * 0.03;
    this._mix = params.mix;
    this.applyMix(params.mix);

    this.rebuildCache();
  }

  private _vinylLevel = 0.01;
  private _mix: EngineParams['mix'];

  private rebuildCache(): void {
    this.cachedProg = getProgressionById(this.currentProgressionId);
    this.cachedPattern = getPattern(this.currentMood);
    this.cachedChordStepSet = new Set(this.cachedPattern.chordSteps);
    this.cachedBassStepToInterval = new Map(
      this.cachedPattern.bassSteps.map(b => [b.step, b.interval])
    );
    const chordSemi = this.currentOctaveShift * 12 + this.currentKeyShift;
    this.cachedChordNotes = this.cachedProg.chords.map(chord =>
      chord.notes.map(n => this.transpose(n, chordSemi))
    );
    this.cachedBassRoots = this.cachedProg.bassRoots.map(n => this.transpose(n, this.currentKeyShift));
    this.cachedBassThirds = this.cachedProg.bassThirds.map(n => this.transpose(n, this.currentKeyShift));
    this.cachedBassFifths = this.cachedProg.bassFifths.map(n => this.transpose(n, this.currentKeyShift));
    // Approach note = 1 semitone below each chord's (already key-shifted) root
    this.cachedBassApproach = this.cachedBassRoots.map(n => this.transpose(n, -1));
    const melSemi = this.currentMelodyOctave * 12 + this.currentKeyShift;
    this.cachedMelodyNotes = this.cachedProg.melodyNotes.map(n => this.transpose(n, melSemi));
    this.cachedMelodyFreqs = this.cachedMelodyNotes.map(n => Tone.Frequency(n).toFrequency());
  }

  private applyMix(mix: EngineParams['mix']): void {
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody'] as const).forEach(k => {
      this.gates[k].gain.rampTo(mix[k] ? 1 : 0, 0.02);
    });
    this.gates.vinyl.gain.rampTo(mix.vinyl ? this._vinylLevel : 0, 0.05);
  }

  private transpose(note: string, semitones: number): string {
    if (semitones === 0) return note;
    return Tone.Frequency(note).transpose(semitones).toNote() as string;
  }

  // Uses pre-computed cachedMelodyNotes/Freqs; reuses melodyPatternBuf without allocating.
  // Finds the two closest notes to prevMelodyNote via linear scan instead of spread+sort.
  private generateMelodyPattern(): void {
    const DURATIONS = ['8n', '4n', '4n', '4n', '2n'] as const;
    this.melodyPatternBuf.fill(null);
    let prev = this.prevMelodyNote;
    let prevHz = prev ? Tone.Frequency(prev).toFrequency() : 0;
    let i = 0;

    while (i < STEPS) {
      if (Math.random() < 0.4) {
        let noteIdx: number;
        if (prev) {
          let best0 = 0, best1 = 0;
          let bestDist0 = Infinity, bestDist1 = Infinity;
          for (let j = 0; j < this.cachedMelodyFreqs.length; j++) {
            const dist = Math.abs(this.cachedMelodyFreqs[j] - prevHz);
            if (dist < bestDist0) { bestDist1 = bestDist0; best1 = best0; bestDist0 = dist; best0 = j; }
            else if (dist < bestDist1) { bestDist1 = dist; best1 = j; }
          }
          noteIdx = Math.random() < 0.5 && this.cachedMelodyNotes.length > 1 ? best1 : best0;
        } else {
          noteIdx = Math.floor(Math.random() * this.cachedMelodyNotes.length);
        }
        const dur = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
        this.melodyPatternBuf[i] = { note: this.cachedMelodyNotes[noteIdx], dur };
        prev = this.cachedMelodyNotes[noteIdx];
        prevHz = this.cachedMelodyFreqs[noteIdx];
        const stepSpan = dur === '2n' ? 8 : dur === '4n' ? 4 : 2;
        i += stepSpan;
      } else {
        i++;
      }
    }
  }

  async start(): Promise<void> {
    await Tone.start();
    this.vinyl.start();
    this.currentStep = 0;
    this.chordIndex = 0;
    this.prevMelodyNote = null;
    this.generateMelodyPattern();

    this.sequence = new Tone.Sequence(
      (time, step) => {
        this.currentStep = step as number;
        this.tick(time, step as number);
      },
      Array.from({ length: STEPS }, (_, i) => i),
      '16n'
    );

    this.sequence.start(0);
    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    this.sequence?.stop();
    this.sequence?.dispose();
    this.sequence = null;
    this.vinyl.stop();
    this.chordSynth.releaseAll();
  }

  // tick() is called on every 16th note step. It must not allocate — all data comes from caches.
  private tick(time: number, step: number): void {
    if (step === 0) {
      this.chordIndex = (this.chordIndex + 1) % this.cachedProg.chords.length;
      this.generateMelodyPattern();
    }

    const shiftedNotes = this.cachedChordNotes[this.chordIndex];

    if (this.cachedPattern.kick[step] && Math.random() < this.currentDrumProb.kick) {
      this.kick.triggerAttackRelease('C1', '8n', time);
    }

    if (this.cachedPattern.snare[step] && Math.random() < this.currentDrumProb.snare) {
      this.snare.triggerAttackRelease('8n', time);
    }

    if (this.cachedPattern.hihat[step] && Math.random() < this.currentDrumProb.hihat) {
      this.hihat.triggerAttackRelease('32n', time, 0.3 + Math.random() * 0.2);
    }

    if (this.cachedChordStepSet.has(step)) {
      const jitter = Math.random() * this.currentChordTiming * 0.12;
      this.chordSynth.triggerAttackRelease(shiftedNotes, this.currentChordLength, time + jitter, 0.5 + Math.random() * 0.1);
    }

    if (this.currentBassStyle === 'walking') {
      const walkPos = WALKING_STEPS.indexOf(step);
      if (walkPos >= 0) {
        let bassNote: string;
        if (walkPos === 0) bassNote = this.cachedBassRoots[this.chordIndex];
        else if (walkPos === 1) bassNote = this.cachedBassThirds[this.chordIndex];
        else if (walkPos === 2) bassNote = this.cachedBassFifths[this.chordIndex];
        else bassNote = this.cachedBassApproach[(this.chordIndex + 1) % this.cachedProg.chords.length];
        this.bassSynth.triggerAttackRelease(bassNote, '4n', time, 0.75);
      }
    } else {
      const interval = this.cachedBassStepToInterval.get(step);
      if (interval !== undefined) {
        const raw = interval === 0 ? this.cachedBassRoots[this.chordIndex] : this.cachedBassFifths[this.chordIndex];
        this.bassSynth.triggerAttackRelease(raw, '8n', time, 0.7);
      }
    }

    const melHit = this.melodyPatternBuf[step];
    if (melHit !== null) {
      const jitter = Math.random() * this.currentChordTiming * 0.08;
      this.melodySynth.triggerAttackRelease(melHit.note, melHit.dur, time + jitter, 0.3 + Math.random() * 0.1);
      this.prevMelodyNote = melHit.note;
    }
  }

  updateParams(params: Partial<EngineParams>): void {
    let needsRebuild = false;

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
    if (params.drumProb !== undefined) {
      this.currentDrumProb = { ...params.drumProb };
    }
    if (params.reverb !== undefined) {
      this.reverb.wet.rampTo(params.reverb, 0.2);
    }
    if (params.vinyl !== undefined) {
      this._vinylLevel = params.vinyl * 0.03;
      if (this._mix.vinyl) this.vinylGain.gain.rampTo(this._vinylLevel, 0.2);
    }
    if (params.lowCut !== undefined) {
      this.highpass.frequency.rampTo(params.lowCut, 0.1);
    }
    if (params.highCut !== undefined) {
      this.lowpass.frequency.rampTo(params.highCut, 0.1);
    }
    if (params.mix !== undefined) {
      this._mix = params.mix;
      this.applyMix(params.mix);
    }
    if (params.bassStyle !== undefined) {
      this.currentBassStyle = params.bassStyle;
    }

    if (needsRebuild) {
      this.rebuildCache();
      this.generateMelodyPattern();
    }
  }

  getStep(): number {
    return this.currentStep;
  }

  getChordIndex(): number {
    return this.chordIndex;
  }

  dispose(): void {
    this.stop();
    this.chordSynth.dispose();
    this.chordTremolo.dispose();
    this.bassSynth.dispose();
    this.melodySynth.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.vinyl.dispose();
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'vinyl'] as const).forEach(k => this.gates[k].dispose());
    this.reverb.dispose();
    this.lowpass.dispose();
    this.highpass.dispose();
    this.limiter.dispose();
  }
}
