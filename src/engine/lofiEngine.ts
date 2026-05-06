import * as Tone from 'tone';
import { getProgressionById, getPattern, SONG_ARRANGEMENT, locateSection } from './musicTheory';
import type { EngineParams, Mood, ProgressionDef, RhythmPattern, SectionInfo, InstrumentMix } from './types';

const STEPS = 16;
const WALKING_STEPS = [0, 4, 8, 12];
// Lazy walking: just two notes per bar — downbeat root, then a syncopated
// approach/fifth on the "and of 3" so it feels behind the beat.
const LAZY_STEPS = [0, 10];

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
  private currentBassStyle: 'simple' | 'walking' | 'lazy' = 'simple';
  private currentStep = 0;
  private chordIndex = 0;

  // Song-form state
  private songFormEnabled = false;
  private currentBar = 0;
  private sectionIdx = 0;
  private barInSection = 0;
  private isFillBar = false;

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
    this.songFormEnabled = params.songForm;

    // Effects chain: instruments → gates → highpass → lowpass → reverb → limiter
    // Chorus removed from master bus — it processed all instruments simultaneously.
    // The chord tremolo still provides movement on the pad specifically.
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: 0.35, wet: params.reverb }).connect(this.limiter);
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

  // Combines the user's mix with the active section's mute overrides. On a
  // fill bar the muted instruments come back so the fill is audible.
  private effectiveMix(): InstrumentMix {
    if (!this.songFormEnabled) return this._mix;
    const sec = SONG_ARRANGEMENT[this.sectionIdx];
    if (!sec.mutes || sec.mutes.length === 0 || this.isFillBar) return this._mix;
    const eff = { ...this._mix };
    for (const k of sec.mutes) eff[k] = false;
    return eff;
  }

  private applyEffectiveMix(): void {
    this.applyMix(this.effectiveMix());
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
  }

  private transpose(note: string, semitones: number): string {
    if (semitones === 0) return note;
    return Tone.Frequency(note).transpose(semitones).toNote() as string;
  }

  // Generates 1–2 short directional phrases per bar instead of a random per-step walk.
  // Each phrase moves mostly stepwise (ascending or descending) through the sorted note pool,
  // ending on a longer note for a sense of resolution.
  private generateMelodyPattern(): void {
    this.melodyPatternBuf.fill(null);

    // Sort note indices by pitch so we can navigate by direction
    const sorted = Array.from({ length: this.cachedMelodyNotes.length }, (_, i) => i)
      .sort((a, b) => this.cachedMelodyFreqs[a] - this.cachedMelodyFreqs[b]);
    const poolLen = sorted.length;

    // Start position: closest pitch to where we left off last bar
    const prevFreq = this.prevMelodyNote
      ? Tone.Frequency(this.prevMelodyNote).toFrequency()
      : this.cachedMelodyFreqs[sorted[Math.floor(poolLen / 2)]];
    let pos = sorted.reduce((best, idx, p) =>
      Math.abs(this.cachedMelodyFreqs[idx] - prevFreq) <
      Math.abs(this.cachedMelodyFreqs[sorted[best]] - prevFreq) ? p : best, 0);

    let step = Math.floor(Math.random() * 3); // small initial offset for feel
    const phraseCount = 1 + (Math.random() < 0.55 ? 1 : 0);

    for (let p = 0; p < phraseCount; p++) {
      if (step >= STEPS - 2) break;

      let dir = Math.random() < 0.5 ? 1 : -1;
      const phraseLen = 2 + Math.floor(Math.random() * 3); // 2–4 notes

      for (let ni = 0; ni < phraseLen; ni++) {
        if (step >= STEPS) break;

        const isLast = ni === phraseLen - 1;
        // Phrase ends on a quarter or half note; interior notes use eighths or quarters
        const dur = isLast
          ? (Math.random() < 0.5 ? '4n' : '2n')
          : (Math.random() < 0.55 ? '4n' : '8n');

        this.melodyPatternBuf[step] = {
          note: this.cachedMelodyNotes[sorted[pos]],
          dur,
        };
        this.prevMelodyNote = this.cachedMelodyNotes[sorted[pos]];
        step += dur === '2n' ? 8 : dur === '4n' ? 4 : 2;

        // Mostly step motion (1 pitch position), occasionally skip (2)
        const jump = Math.random() < 0.7 ? 1 : 2;
        pos = Math.max(0, Math.min(poolLen - 1, pos + dir * jump));
        // Reverse at boundaries or occasionally mid-phrase
        if (pos === 0 || pos === poolLen - 1 || Math.random() < 0.2) dir = -dir;
      }

      // Rest gap between phrases
      step += 2 + Math.floor(Math.random() * 5);
    }
  }

  async start(): Promise<void> {
    await this.reverb.ready;
    await Tone.start();
    this.vinyl.start();
    this.currentStep = 0;
    this.chordIndex = this.cachedProg.chords.length - 1;
    this.prevMelodyNote = null;
    this.currentBar = 0;
    this.updateSection();
    this.applyEffectiveMix();
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

    const drumScale = this.songFormEnabled
      ? (SONG_ARRANGEMENT[this.sectionIdx].drumDensity ?? 1)
      : 1;

    if (this.cachedPattern.kick[step] && Math.random() < this.currentDrumProb.kick * drumScale) {
      this.kick.triggerAttackRelease('C1', '8n', time);
    }

    if (this.cachedPattern.snare[step] && Math.random() < this.currentDrumProb.snare * drumScale) {
      this.snare.triggerAttackRelease('8n', time);
    }

    if (this.cachedPattern.hihat[step] && Math.random() < this.currentDrumProb.hihat * drumScale) {
      this.hihat.triggerAttackRelease('32n', time, 0.3 + Math.random() * 0.2);
    }

    // Snare-roll fill on the last beat of a fill bar, telegraphing the next section.
    if (this.isFillBar && step >= 12) {
      const vel = 0.32 + (step - 12) * 0.16;
      this.snare.triggerAttackRelease('16n', time, vel);
      if (step === 12) this.kick.triggerAttackRelease('C1', '16n', time, 0.6);
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
    } else if (this.currentBassStyle === 'lazy') {
      const lazyPos = LAZY_STEPS.indexOf(step);
      if (lazyPos === 0) {
        // Long sustained root on the downbeat
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '2n', time, 0.7);
      } else if (lazyPos === 1) {
        // Syncopated fifth, dragged feel via small late jitter
        const drag = Math.random() * 0.02;
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '4n', time + drag, 0.6);
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
      this.melodySynth.triggerAttackRelease(melHit.note, melHit.dur, time + jitter, 0.45 + Math.random() * 0.15);
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
      this.applyEffectiveMix();
    }
    if (params.bassStyle !== undefined) {
      this.currentBassStyle = params.bassStyle;
    }
    if (params.songForm !== undefined && params.songForm !== this.songFormEnabled) {
      this.songFormEnabled = params.songForm;
      if (this.songFormEnabled) this.currentBar = 0;
      this.updateSection();
      this.applyEffectiveMix();
    }

    if (needsRebuild) {
      this.rebuildCache();
      this.chordIndex = this.cachedProg.chords.length - 1;
      this.generateMelodyPattern();
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
