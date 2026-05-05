import * as Tone from 'tone';
import { getProgressionById, getPattern } from './musicTheory';
import type { EngineParams, Mood } from './types';

const STEPS = 16;

export class LofiEngine {
  private chordSynth: Tone.PolySynth;
  private bassSynth: Tone.MonoSynth;
  private melodySynth: Tone.Synth;
  private kick: Tone.MembraneSynth;
  private snare: Tone.NoiseSynth;
  private hihat: Tone.MetalSynth;
  private vinyl: Tone.Noise;
  private vinylGain: Tone.Gain;

  private reverb: Tone.Reverb;
  private chorus: Tone.Chorus;
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
  private currentStep = 0;
  private chordIndex = 0;

  // Melody state
  private melodyPattern: ({ note: string; dur: string } | null)[] = new Array(STEPS).fill(null);
  private prevMelodyNote: string | null = null;

  constructor(params: EngineParams) {
    this.currentMood = params.mood;
    this.currentProgressionId = params.progressionId;
    this.currentOctaveShift = params.octaveShift;
    this.currentMelodyOctave = params.melodyOctave;
    this.currentChordLength = params.chordLength;
    this.currentChordTiming = params.chordTiming;
    this.currentDrumProb = { ...params.drumProb };

    // Effects chain: instruments → gates → highpass → lowpass → chorus → reverb → limiter
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: 3.5, wet: params.reverb }).connect(this.limiter);
    this.chorus = new Tone.Chorus(1.5, 2.5, 0.15).connect(this.reverb);
    this.chorus.start();
    this.lowpass = new Tone.Filter(params.highCut, 'lowpass').connect(this.chorus);
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

    // Chord pad
    this.chordSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 1.2 },
      volume: -14,
    }).connect(this.gates.chord);

    // Bass
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      filter: { frequency: 300, type: 'lowpass' },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.8 },
      volume: -10,
    }).connect(this.gates.bass);

    // Melody — soft sine lead, one octave above chords
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
  }

  private _vinylLevel = 0.01;
  private _mix: EngineParams['mix'];

  private applyMix(mix: EngineParams['mix']): void {
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody'] as const).forEach(k => {
      this.gates[k].gain.rampTo(mix[k] ? 1 : 0, 0.02);
    });
    this.gates.vinyl.gain.rampTo(mix.vinyl ? this._vinylLevel : 0, 0.05);
  }

  private generateMelodyPattern(melodyNotes: string[]): void {
    const DURATIONS = ['8n', '4n', '4n', '4n', '2n'];
    const pattern: ({ note: string; dur: string } | null)[] = new Array(STEPS).fill(null);
    let prev = this.prevMelodyNote;
    let i = 0;

    while (i < STEPS) {
      if (Math.random() < 0.4) {
        let note: string;
        if (prev) {
          const prevHz = Tone.Frequency(prev).toFrequency();
          const sorted = [...melodyNotes].sort(
            (a, b) => Math.abs(Tone.Frequency(a).toFrequency() - prevHz)
                    - Math.abs(Tone.Frequency(b).toFrequency() - prevHz)
          );
          note = sorted[Math.floor(Math.random() * Math.min(2, sorted.length))];
        } else {
          note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
        }
        const dur = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
        pattern[i] = { note, dur };
        prev = note;

        // Advance by the duration so longer notes block out subsequent steps
        const stepSpan = dur === '2n' ? 8 : dur === '4n' ? 4 : 2;
        i += stepSpan;
      } else {
        i++;
      }
    }
    this.melodyPattern = pattern;
  }

  async start(): Promise<void> {
    await Tone.start();
    this.vinyl.start();
    this.currentStep = 0;
    this.chordIndex = 0;
    this.prevMelodyNote = null;

    // Generate first bar's melody before the sequence starts
    const prog = getProgressionById(this.currentProgressionId);
    this.generateMelodyPattern(prog.melodyNotes);

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

  private tick(time: number, step: number): void {
    const pattern = getPattern(this.currentMood);
    const prog = getProgressionById(this.currentProgressionId);

    // Advance chord every 16 steps (1 bar) and generate next melody pattern
    if (step === 0) {
      this.chordIndex = (this.chordIndex + 1) % prog.chords.length;
      this.generateMelodyPattern(prog.melodyNotes);
    }

    const chord = prog.chords[this.chordIndex];
    const semitones = this.currentOctaveShift * 12;
    const shiftedNotes = semitones === 0
      ? chord.notes
      : chord.notes.map(n => Tone.Frequency(n).transpose(semitones).toNote());

    // Kick
    if (pattern.kick[step] && Math.random() < this.currentDrumProb.kick) {
      this.kick.triggerAttackRelease('C1', '8n', time);
    }

    // Snare
    if (pattern.snare[step] && Math.random() < this.currentDrumProb.snare) {
      this.snare.triggerAttackRelease('8n', time);
    }

    // Hi-hat
    if (pattern.hihat[step] && Math.random() < this.currentDrumProb.hihat) {
      const vel = 0.3 + Math.random() * 0.2;
      this.hihat.triggerAttackRelease('32n', time, vel);
    }

    // Chord stab — timing jitter drags behind the beat (lofi feel)
    if (pattern.chordSteps.includes(step)) {
      const jitter = Math.random() * this.currentChordTiming * 0.12;
      this.chordSynth.triggerAttackRelease(shiftedNotes, this.currentChordLength, time + jitter, 0.5 + Math.random() * 0.1);
    }

    // Bass
    const bassHit = pattern.bassSteps.find(b => b.step === step);
    if (bassHit) {
      const note = bassHit.interval === 0
        ? prog.bassRoots[this.chordIndex]
        : prog.bassFifths[this.chordIndex];
      this.bassSynth.triggerAttackRelease(note, '8n', time, 0.7);
    }

    // Melody — apply octave shift at read-time for immediate response
    const melHit = this.melodyPattern[step];
    if (melHit !== null) {
      const melSemitones = this.currentMelodyOctave * 12;
      const melNote = melSemitones === 0
        ? melHit.note
        : Tone.Frequency(melHit.note).transpose(melSemitones).toNote();
      const jitter = Math.random() * this.currentChordTiming * 0.08;
      this.melodySynth.triggerAttackRelease(melNote, melHit.dur, time + jitter, 0.3 + Math.random() * 0.1);
      this.prevMelodyNote = melHit.note;
    }
  }

  updateParams(params: Partial<EngineParams>): void {
    if (params.bpm !== undefined) {
      Tone.getTransport().bpm.rampTo(params.bpm, 0.1);
    }
    if (params.mood !== undefined) {
      this.currentMood = params.mood;
    }
    if (params.progressionId !== undefined) {
      this.currentProgressionId = params.progressionId;
      this.chordIndex = 0;
      this.prevMelodyNote = null;
    }
    if (params.octaveShift !== undefined) {
      this.currentOctaveShift = params.octaveShift;
    }
    if (params.melodyOctave !== undefined) {
      this.currentMelodyOctave = params.melodyOctave;
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
    this.bassSynth.dispose();
    this.melodySynth.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
    this.vinyl.dispose();
    (['chord', 'bass', 'kick', 'snare', 'hihat', 'melody', 'vinyl'] as const).forEach(k => this.gates[k].dispose());
    this.chorus.dispose();
    this.reverb.dispose();
    this.lowpass.dispose();
    this.highpass.dispose();
    this.limiter.dispose();
  }
}
