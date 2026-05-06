import * as Tone from 'tone';
import { getProgressionById, getPattern, SONG_ARRANGEMENT, locateSection } from './musicTheory';
import type { BassStyle, EngineParams, Mood, ProgressionDef, RhythmPattern, SectionInfo, InstrumentMix, TimeSignature } from './types';

const DEFAULT_STEPS_PER_BAR = 16;

type MelodyDur = '8n' | '4n' | '2n';

interface Motif {
  // Pitch deltas relative to the bar's anchor position in the sorted melody pool.
  // First entry is always 0 (the anchor itself).
  deltas: number[];
  durs: MelodyDur[];
  // Where in the bar the motif starts (0–4 sixteenths).
  startStep: number;
}

export class LofiEngine {
  private chordSynth: Tone.PolySynth<Tone.FMSynth>;
  private chordTremolo: Tone.Tremolo;
  private bassSynth: Tone.MonoSynth;
  private melodySynth: Tone.Synth;
  private counterSynth: Tone.Synth;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hihat: Tone.MetalSynth;
  private vinyl: Tone.Noise;
  private vinylGain: Tone.Gain;

  private reverb: Tone.Reverb;
  private limiter: Tone.Limiter;
  private lowpass: Tone.Filter;
  private highpass: Tone.Filter;
  private tapeWow: Tone.Vibrato;
  private tapeFlutter: Tone.Vibrato;
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
  private currentBassStyle: BassStyle = 'simple';
  private currentTimeSignature: TimeSignature = '4/4';
  private currentStepsPerBar = DEFAULT_STEPS_PER_BAR;
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
  private cachedBassOctaves!: string[];
  private cachedBassApproach!: string[];
  private cachedBassQuarterStep = 4;
  private cachedBassHalfStep = 8;
  private cachedBassThreeQuarterStep = 12;
  private cachedBassPickupStep = 14;
  private cachedMelodyNotes!: string[];
  private cachedMelodyFreqs!: number[];
  // Indices into cachedMelodyNotes sorted by ascending pitch — stable across bars.
  private cachedSortedMelodyIdx!: number[];
  // Per chord, the positions in cachedSortedMelodyIdx whose pitch class belongs
  // to the chord. Used to resolve phrase endings onto chord tones (tension/release)
  // and to harmonize the counter line.
  private cachedChordTonePos!: number[][];

  // Pre-allocated melody pattern buffer — cleared and reused each bar
  private melodyPatternBuf: ({ note: string; dur: MelodyDur } | null)[] = new Array(DEFAULT_STEPS_PER_BAR).fill(null);
  // Counter-melody buffer: a soft harmony line a third or sixth below the lead,
  // populated only on longer notes so the texture stays sparse.
  private counterPatternBuf: ({ note: string; dur: MelodyDur } | null)[] = new Array(DEFAULT_STEPS_PER_BAR).fill(null);
  private prevMelodyNote: string | null = null;

  // Motif state — the current repeating idea and how many bars it has lived.
  private motif: Motif | null = null;
  private motifAge = 0;
  private motifMaxBars = 0;

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
    this.currentTimeSignature = params.timeSignature;
    this.songFormEnabled = params.songForm;

    // Effects chain: instruments → gates → highpass → lowpass → tape → reverb → limiter
    // Chorus removed from master bus — it processed all instruments simultaneously.
    // The chord tremolo still provides movement on the pad specifically.
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: 0.35, wet: params.reverb }).connect(this.limiter);
    this.tapeFlutter = new Tone.Vibrato({
      frequency: 6.2,
      depth: 0.008,
      maxDelay: 0.004,
      type: 'triangle',
      wet: 0,
    }).connect(this.reverb);
    this.tapeWow = new Tone.Vibrato({
      frequency: 0.18,
      depth: 0.055,
      maxDelay: 0.03,
      type: 'sine',
      wet: 0,
    }).connect(this.tapeFlutter);
    this.lowpass = new Tone.Filter(params.highCut, 'lowpass').connect(this.tapeWow);
    this.highpass = new Tone.Filter(params.lowCut, 'highpass').connect(this.lowpass);

    const g = (on: boolean) => new Tone.Gain(on ? 1 : 0).connect(this.highpass);
    this.gates = {
      chord:   g(params.mix.chord),
      bass:    g(params.mix.bass),
      kick:    g(params.mix.kick),
      snare:   g(params.mix.snare),
      hihat:   g(params.mix.hihat),
      melody:  g(params.mix.melody),
      counter: g(params.mix.counter),
      vinyl:   new Tone.Gain(params.mix.vinyl ? params.vinyl * 0.03 : 0).connect(this.limiter),
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
    this.applyTape(params.tape, 0);
    this.applyMix(params.mix);

    this.rebuildCache();
  }

  private _vinylLevel = 0.01;
  private _mix: EngineParams['mix'];

  private rebuildCache(): void {
    this.cachedProg = getProgressionById(this.currentProgressionId);
    this.cachedPattern = getPattern(this.currentMood, this.currentTimeSignature);
    this.currentStepsPerBar = this.cachedPattern.stepsPerBar;
    this.ensurePatternBuffers();
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
    this.cachedBassOctaves = this.cachedProg.bassRoots.map(n => this.transpose(n, this.currentKeyShift + 12));
    // Approach note = 1 semitone below each chord's (already key-shifted) root
    this.cachedBassApproach = this.cachedBassRoots.map(n => this.transpose(n, -1));
    this.cachedBassQuarterStep = Math.floor(this.currentStepsPerBar / 4);
    this.cachedBassHalfStep = Math.floor(this.currentStepsPerBar / 2);
    this.cachedBassThreeQuarterStep = Math.floor((this.currentStepsPerBar * 3) / 4);
    this.cachedBassPickupStep = Math.max(0, this.currentStepsPerBar - 2);
    const melSemi = this.currentMelodyOctave * 12 + this.currentKeyShift;
    this.cachedMelodyNotes = this.cachedProg.melodyNotes.map(n => this.transpose(n, melSemi));
    this.cachedMelodyFreqs = this.cachedMelodyNotes.map(n => Tone.Frequency(n).toFrequency());

    // Sort once per cache rebuild — the bar-loop just reads it.
    this.cachedSortedMelodyIdx = Array.from({ length: this.cachedMelodyNotes.length }, (_, i) => i)
      .sort((a, b) => this.cachedMelodyFreqs[a] - this.cachedMelodyFreqs[b]);

    // For each chord, find which positions in the sorted pool are chord tones
    // (pitch class matches a chord pitch class). Used for resolution + counter.
    const sortedPCs = this.cachedSortedMelodyIdx.map(idx =>
      Tone.Frequency(this.cachedMelodyNotes[idx]).toMidi() % 12
    );
    this.cachedChordTonePos = this.cachedChordNotes.map(chord => {
      const chordPCs = new Set(chord.map(n => Tone.Frequency(n).toMidi() % 12));
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
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'counter'] as const).forEach(k => {
      this.gates[k].gain.rampTo(mix[k] ? 1 : 0, 0.02);
    });
    this.gates.vinyl.gain.rampTo(mix.vinyl ? this._vinylLevel : 0, 0.05);
  }

  private applyTape(amount: number, rampTime = 0.2): void {
    const tape = Math.max(0, Math.min(1, amount));
    this.tapeWow.wet.rampTo(tape, rampTime);
    this.tapeFlutter.wet.rampTo(tape * 0.45, rampTime);
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
    this.motif = null;
    this.motifAge = 0;
    this.motifMaxBars = 0;
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
  }

  private transpose(note: string, semitones: number): string {
    if (semitones === 0) return note;
    return Tone.Frequency(note).transpose(semitones).toNote() as string;
  }

  // Builds a fresh motif: a small directed melodic idea that we'll repeat (with
  // variations) for the next several bars. The motif is stored as deltas
  // relative to the bar's anchor position in the sorted pool, so when the
  // anchor moves with the chord change the same shape replays at a new pitch.
  private generateMotif(): Motif {
    const noteCount = 3 + Math.floor(Math.random() * 2); // 3–4 notes
    const deltas: number[] = [0];
    let cur = 0;
    let dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 1; i < noteCount; i++) {
      const jump = Math.random() < 0.75 ? 1 : 2; // mostly stepwise, occasional skip
      cur += dir * jump;
      deltas.push(cur);
      if (Math.random() < 0.3) dir = -dir;
    }
    const durs: MelodyDur[] = [];
    for (let i = 0; i < noteCount; i++) {
      const isLast = i === noteCount - 1;
      durs.push(isLast
        ? (Math.random() < 0.55 ? '4n' : '2n')
        : (Math.random() < 0.55 ? '4n' : '8n'));
    }
    return {
      deltas,
      durs,
      startStep: Math.floor(Math.random() * 3),
    };
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
  private findCounterPos(leadPos: number, chordTonePos: number[]): number {
    const target = leadPos - 2;
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

  // Renders the active motif into the melody (and counter) buffers for this bar.
  // Motif lifecycle: a fresh motif is generated, repeated for 3–6 bars with
  // light variations (inversion, transposition jitter), then replaced. Anchor
  // position tracks the previous bar's last note so phrases connect smoothly,
  // and the final note of every motif is snapped to a chord tone for resolution.
  private generateMelodyPattern(): void {
    this.melodyPatternBuf.fill(null);
    this.counterPatternBuf.fill(null);

    const sorted = this.cachedSortedMelodyIdx;
    const poolLen = sorted.length;
    if (poolLen === 0) return;

    const chordTonePos = this.cachedChordTonePos[this.chordIndex];

    if (!this.motif || this.motifAge >= this.motifMaxBars) {
      this.motif = this.generateMotif();
      this.motifAge = 0;
      this.motifMaxBars = 3 + Math.floor(Math.random() * 4); // 3–6 bars
    }
    const motif = this.motif;

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
      anchor = best;
    } else {
      anchor = chordTonePos[Math.floor(chordTonePos.length / 2)] ?? Math.floor(poolLen / 2);
    }

    // Variations applied at older motif ages so the listener hears the idea
    // repeat first, then evolve. Inversion flips the contour; the jitter
    // version nudges every delta slightly to sidestep verbatim repetition.
    let workingDeltas = motif.deltas;
    if (this.motifAge === 2 && Math.random() < 0.45) {
      workingDeltas = motif.deltas.map(d => -d);
    } else if (this.motifAge >= 3 && Math.random() < 0.5) {
      workingDeltas = motif.deltas.map((d, i) =>
        i === 0 ? d : d + (Math.random() < 0.5 ? 1 : -1)
      );
    }

    let step = motif.startStep;
    const lastIdx = workingDeltas.length - 1;
    for (let i = 0; i < workingDeltas.length; i++) {
      if (step >= this.currentStepsPerBar) break;

      let pos = Math.max(0, Math.min(poolLen - 1, anchor + workingDeltas[i]));
      // Tension/release: the closing note of the motif lands on a chord tone.
      if (i === lastIdx) {
        pos = this.nearestChordTonePos(pos, chordTonePos);
      }

      const dur = motif.durs[i];
      const note = this.cachedMelodyNotes[sorted[pos]];
      this.melodyPatternBuf[step] = { note, dur };

      // Counter line: only on the longer notes so the texture stays sparse.
      if (dur !== '8n') {
        const cPos = this.findCounterPos(pos, chordTonePos);
        if (cPos >= 0) {
          this.counterPatternBuf[step] = {
            note: this.cachedMelodyNotes[sorted[cPos]],
            dur,
          };
        }
      }

      step += dur === '2n' ? 8 : dur === '4n' ? 4 : 2;
    }

    this.motifAge++;
  }

  async start(): Promise<void> {
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

    // Snare-roll fill on the last beat group of a fill bar, telegraphing the next section.
    if (this.isFillBar && step >= this.cachedPattern.fillStartStep) {
      const vel = 0.32 + (step - this.cachedPattern.fillStartStep) * 0.16;
      this.snare.triggerAttackRelease('16n', time, vel);
      if (step === this.cachedPattern.fillStartStep) this.kick.triggerAttackRelease('C1', '16n', time, 0.6);
    }

    if (this.cachedChordStepSet.has(step)) {
      const jitter = Math.random() * this.currentChordTiming * 0.12;
      this.chordSynth.triggerAttackRelease(shiftedNotes, this.currentChordLength, time + jitter, 0.5 + Math.random() * 0.1);
    }

    if (this.currentBassStyle === 'walking') {
      const walkPos = this.cachedPattern.walkingSteps.indexOf(step);
      if (walkPos >= 0) {
        let bassNote: string;
        if (walkPos === 0) bassNote = this.cachedBassRoots[this.chordIndex];
        else if (walkPos === 1) bassNote = this.cachedBassThirds[this.chordIndex];
        else if (walkPos === 2) bassNote = this.cachedBassFifths[this.chordIndex];
        else bassNote = this.cachedBassApproach[(this.chordIndex + 1) % this.cachedProg.chords.length];
        this.bassSynth.triggerAttackRelease(bassNote, '4n', time, 0.75);
      }
    } else if (this.currentBassStyle === 'lazy') {
      const lazyPos = this.cachedPattern.lazySteps.indexOf(step);
      if (lazyPos === 0) {
        // Long sustained root on the downbeat
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '2n', time, 0.7);
      } else if (lazyPos === 1) {
        // Syncopated fifth, dragged feel via small late jitter
        const drag = Math.random() * 0.02;
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '4n', time + drag, 0.6);
      }
    } else if (this.currentBassStyle === 'bounce') {
      if (step === 0) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '8n', time, 0.75);
      } else if (step === this.cachedBassQuarterStep || step === this.cachedBassThreeQuarterStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '16n', time, 0.58);
      } else if (step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassOctaves[this.chordIndex], '8n', time, 0.65);
      }
    } else if (this.currentBassStyle === 'dub') {
      if (step === 0) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '2n', time, 0.72);
      } else if (step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '4n', time, 0.5);
      } else if (step === this.cachedBassPickupStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassApproach[(this.chordIndex + 1) % this.cachedProg.chords.length], '8n', time, 0.55);
      }
    } else if (this.currentBassStyle === 'pedal') {
      if (step === 0 || step === this.cachedBassQuarterStep || step === this.cachedBassHalfStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassRoots[this.chordIndex], '8n', time, 0.62);
      } else if (step === this.cachedBassThreeQuarterStep) {
        this.bassSynth.triggerAttackRelease(this.cachedBassFifths[this.chordIndex], '8n', time, 0.6);
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

      const counterHit = this.counterPatternBuf[step];
      if (counterHit !== null) {
        // Same jitter so lead and harmony lock together rhythmically.
        this.counterSynth.triggerAttackRelease(counterHit.note, counterHit.dur, time + jitter, 0.32 + Math.random() * 0.1);
      }
    }
  }

  updateParams(params: Partial<EngineParams>): void {
    let needsRebuild = false;
    let needsSequenceRestart = false;

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
      // New progression deserves a new motif rather than carrying the old shape over.
      this.motif = null;
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
    if (params.tape !== undefined) {
      this.applyTape(params.tape);
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
      this.applyEffectiveMix();
    }

    if (needsRebuild) {
      const stepsBefore = this.currentStepsPerBar;
      this.rebuildCache();
      this.chordIndex = this.cachedProg.chords.length - 1;
      this.generateMelodyPattern();
      if (this.sequence && (needsSequenceRestart || stepsBefore !== this.currentStepsPerBar)) {
        Tone.getTransport().stop();
        this.sequence.stop();
        this.sequence.dispose();
        this.scheduleSequence().start(0);
        Tone.getTransport().start();
      }
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
    this.counterSynth.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.vinyl.dispose();
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'counter', 'vinyl'] as const).forEach(k => this.gates[k].dispose());
    this.reverb.dispose();
    this.tapeWow.dispose();
    this.tapeFlutter.dispose();
    this.lowpass.dispose();
    this.highpass.dispose();
    this.limiter.dispose();
  }
}
