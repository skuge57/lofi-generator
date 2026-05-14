import * as Tone from 'tone';
import type { SceneId } from './types';

export type { SceneId };

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'dusty-record', label: 'record' },
  { id: 'rainy-window', label: 'rain' },
  { id: 'cafe', label: 'café' },
  { id: 'train', label: 'train' },
  { id: 'distant-street', label: 'street' },
  { id: 'fireplace', label: 'fire' },
  { id: 'late-night', label: 'night' },
];

export class SceneEngine {
  private masterGain: Tone.Gain;
  private noises: Tone.Noise[] = [];
  private oscillators: Tone.Oscillator[] = [];
  private noiseSynths: Tone.NoiseSynth[] = [];
  private membraneSynths: Tone.MembraneSynth[] = [];
  private filters: Tone.Filter[] = [];
  private gains: Tone.Gain[] = [];
  private tremolos: Tone.Tremolo[] = [];
  private loops: Tone.Loop[] = [];

  constructor(scene: SceneId, volume: number) {
    this.masterGain = new Tone.Gain(volume * 0.5).toDestination();
    this.buildScene(scene);
  }

  private noise(type: 'white' | 'pink' | 'brown'): Tone.Noise {
    const n = new Tone.Noise(type);
    this.noises.push(n);
    return n;
  }

  private osc(freq: number, type: 'sine' | 'triangle'): Tone.Oscillator {
    const o = new Tone.Oscillator(freq, type);
    this.oscillators.push(o);
    return o;
  }

  private filt(freq: number, type: BiquadFilterType, Q = 1): Tone.Filter {
    const f = new Tone.Filter({ frequency: freq, type, Q });
    this.filters.push(f);
    return f;
  }

  private gain(value: number): Tone.Gain {
    const g = new Tone.Gain(value);
    this.gains.push(g);
    return g;
  }

  private noiseSynth(opts: Tone.NoiseSynthOptions | Record<string, unknown>): Tone.NoiseSynth {
    const s = new Tone.NoiseSynth(opts as Tone.NoiseSynthOptions);
    this.noiseSynths.push(s);
    return s;
  }

  private membraneSynth(opts: Tone.MembraneSynthOptions | Record<string, unknown>): Tone.MembraneSynth {
    const s = new Tone.MembraneSynth(opts as Tone.MembraneSynthOptions);
    this.membraneSynths.push(s);
    return s;
  }

  private loop(interval: Tone.Unit.Time, cb: (time: number) => void): Tone.Loop {
    const l = new Tone.Loop(cb, interval);
    this.loops.push(l);
    return l;
  }

  private buildScene(scene: SceneId): void {
    switch (scene) {
      case 'dusty-record':    return this.buildDustyRecord();
      case 'rainy-window':    return this.buildRainyWindow();
      case 'cafe':            return this.buildCafe();
      case 'train':           return this.buildTrain();
      case 'distant-street':  return this.buildDistantStreet();
      case 'fireplace':       return this.buildFireplace();
      case 'late-night':      return this.buildLateNight();
    }
  }

  // ─── Dusty Record ─────────────────────────────────────────────────────────

  private buildDustyRecord(): void {
    // Warm dust bed
    const dustBed = this.noise('pink');
    const bedFilter = this.filt(1800, 'bandpass', 0.8);
    const bedGain = this.gain(0.28);
    dustBed.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(this.masterGain);

    // Sub rumble
    const rumble = this.noise('pink');
    const rumbleFilter = this.filt(180, 'lowpass');
    const rumbleGain = this.gain(0.07);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    // Clicks
    const click = this.noiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.013, sustain: 0, release: 0.02 },
      volume: -3,
    });
    const clickFilter = this.filt(5200, 'highpass', 0.6);
    click.connect(clickFilter);
    clickFilter.connect(this.masterGain);

    // Pops
    const pop = this.membraneSynth({
      pitchDecay: 0.038,
      octaves: 2.4,
      envelope: { attack: 0.001, decay: 0.085, sustain: 0, release: 0.045 },
      volume: -7,
    });
    pop.connect(this.masterGain);

    this.loop(0.07, (time) => {
      if (Math.random() < 0.26) {
        click.triggerAttackRelease('64n', time + Math.random() * 0.01, 0.3 + Math.random() * 0.5);
      }
      if (Math.random() < 0.035) {
        const note = Math.random() < 0.5 ? 'C2' : 'F1';
        pop.triggerAttackRelease(note, '16n', time + Math.random() * 0.015, 0.5 + Math.random() * 0.35);
      }
    });
  }

  // ─── Rainy Window ─────────────────────────────────────────────────────────

  private buildRainyWindow(): void {
    // Rain hiss
    const rain = this.noise('white');
    const rainFilter = this.filt(2000, 'bandpass', 1.3);
    const rainGain = this.gain(0.38);
    rain.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(this.masterGain);

    // Room resonance undertone
    const sub = this.noise('pink');
    const subFilter = this.filt(130, 'lowpass');
    const subGain = this.gain(0.045);
    sub.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.masterGain);

    // Rain drops (high transients)
    const drop = this.noiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.022, sustain: 0, release: 0.04 },
      volume: -9,
    });
    const dropFilter = this.filt(4200, 'highpass', 0.55);
    drop.connect(dropFilter);
    dropFilter.connect(this.masterGain);

    this.loop(0.05, (time) => {
      if (Math.random() < 0.2) {
        drop.triggerAttackRelease('64n', time + Math.random() * 0.025, 0.07 + Math.random() * 0.48);
      }
    });
  }

  // ─── Café ─────────────────────────────────────────────────────────────────

  private buildCafe(): void {
    // Crowd murmur with gentle breathing tremolo
    const murmur = this.noise('pink');
    const murmurFilter = this.filt(680, 'bandpass', 0.62);
    const tremolo = new Tone.Tremolo({ frequency: 0.38, depth: 0.14, type: 'sine', wet: 0.55 }).start();
    this.tremolos.push(tremolo);
    const murmurGain = this.gain(0.17);
    murmur.connect(murmurFilter);
    murmurFilter.connect(tremolo);
    tremolo.connect(murmurGain);
    murmurGain.connect(this.masterGain);

    // Soft room fill
    const room = this.noise('pink');
    const roomFilter = this.filt(1800, 'lowpass');
    const roomGain = this.gain(0.04);
    room.connect(roomFilter);
    roomFilter.connect(roomGain);
    roomGain.connect(this.masterGain);

    // Cup / glass clinks
    const clink = this.noiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.065, sustain: 0, release: 0.09 },
      volume: -13,
    });
    const clinkFilter = this.filt(3600, 'highpass', 0.85);
    clink.connect(clinkFilter);
    clinkFilter.connect(this.masterGain);

    this.loop(0.15, (time) => {
      if (Math.random() < 0.011) {
        clink.triggerAttackRelease('64n', time, 0.35 + Math.random() * 0.55);
      }
    });
  }

  // ─── Train ────────────────────────────────────────────────────────────────

  private buildTrain(): void {
    // Engine rumble
    const rumble = this.noise('pink');
    const rumbleFilter = this.filt(165, 'lowpass');
    const rumbleGain = this.gain(0.48);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    // Rushing air / wheels
    const air = this.noise('white');
    const airFilter = this.filt(2600, 'bandpass', 0.58);
    const airGain = this.gain(0.11);
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.masterGain);

    // Rail clacks
    const clack = this.noiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.042, sustain: 0, release: 0.03 },
      volume: -15,
    });
    const clackFilter = this.filt(950, 'bandpass', 2.4);
    clack.connect(clackFilter);
    clackFilter.connect(this.masterGain);

    // Rhythmic clacking — roughly 4 Hz with small jitter
    let phase = 0;
    this.loop(0.05, (time) => {
      phase += 0.05;
      const period = 0.23 + Math.random() * 0.05;
      if (phase >= period) {
        phase = 0;
        clack.triggerAttackRelease('64n', time, 0.22 + Math.random() * 0.38);
      }
    });
  }

  // ─── Distant Street ───────────────────────────────────────────────────────

  private buildDistantStreet(): void {
    // Traffic hum
    const traffic = this.noise('pink');
    const trafficFilter = this.filt(340, 'lowpass');
    const trafficGain = this.gain(0.3);
    traffic.connect(trafficFilter);
    trafficFilter.connect(trafficGain);
    trafficGain.connect(this.masterGain);

    // Mid street noise
    const mid = this.noise('pink');
    const midFilter = this.filt(820, 'bandpass', 0.65);
    const midGain = this.gain(0.06);
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(this.masterGain);

    // Occasional distant car / horn
    const horn = this.noiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.055, decay: 0.28, sustain: 0, release: 0.38 },
      volume: -20,
    });
    const hornFilter = this.filt(620, 'bandpass', 2.2);
    horn.connect(hornFilter);
    hornFilter.connect(this.masterGain);

    this.loop(0.5, (time) => {
      if (Math.random() < 0.008) {
        horn.triggerAttackRelease('4n', time, 0.45 + Math.random() * 0.45);
      }
    });
  }

  // ─── Fireplace ────────────────────────────────────────────────────────────

  private buildFireplace(): void {
    // Fire body
    const fire = this.noise('pink');
    const fireFilter = this.filt(580, 'bandpass', 1.15);
    const fireGain = this.gain(0.22);
    fire.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(this.masterGain);

    // High sizzle layer
    const sizzle = this.noise('pink');
    const sizzleHPF = this.filt(2800, 'highpass', 0.5);
    const sizzleLPF = this.filt(7500, 'lowpass');
    const sizzleGain = this.gain(0.07);
    sizzle.connect(sizzleHPF);
    sizzleHPF.connect(sizzleLPF);
    sizzleLPF.connect(sizzleGain);
    sizzleGain.connect(this.masterGain);

    // Crackles
    const crackle = this.noiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.024, sustain: 0, release: 0.032 },
      volume: -8,
    });
    const crackleFilter = this.filt(1900, 'bandpass', 1.4);
    crackle.connect(crackleFilter);
    crackleFilter.connect(this.masterGain);

    // Pops
    const pop = this.membraneSynth({
      pitchDecay: 0.04,
      octaves: 1.4,
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.045 },
      volume: -12,
    });
    pop.connect(this.masterGain);

    this.loop(0.06, (time) => {
      if (Math.random() < 0.31) {
        crackle.triggerAttackRelease('64n', time + Math.random() * 0.018, 0.1 + Math.random() * 0.65);
      }
      if (Math.random() < 0.024) {
        const note = Math.random() < 0.6 ? 'E2' : 'B2';
        pop.triggerAttackRelease(note, '32n', time, 0.32 + Math.random() * 0.42);
      }
    });
  }

  // ─── Late-night Room ──────────────────────────────────────────────────────

  private buildLateNight(): void {
    // AC / electrical hum (60 Hz fundamental + second harmonic)
    const hum1 = this.osc(60, 'sine');
    const hum1Gain = this.gain(0.013);
    hum1.connect(hum1Gain);
    hum1Gain.connect(this.masterGain);

    const hum2 = this.osc(120, 'sine');
    const hum2Gain = this.gain(0.006);
    hum2.connect(hum2Gain);
    hum2Gain.connect(this.masterGain);

    // Quiet room tone
    const room = this.noise('pink');
    const roomFilter = this.filt(420, 'lowpass');
    const roomGain = this.gain(0.032);
    room.connect(roomFilter);
    roomFilter.connect(roomGain);
    roomGain.connect(this.masterGain);

    // Very rare creak
    const creak = this.noiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.025, decay: 0.18, sustain: 0, release: 0.22 },
      volume: -24,
    });
    const creakFilter = this.filt(380, 'bandpass', 2.2);
    creak.connect(creakFilter);
    creakFilter.connect(this.masterGain);

    this.loop(1, (time) => {
      if (Math.random() < 0.012) {
        creak.triggerAttackRelease('8n', time, 0.4 + Math.random() * 0.45);
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    for (const n of this.noises) n.start();
    for (const o of this.oscillators) o.start();
    for (const l of this.loops) l.start(0);
  }

  stop(): void {
    for (const l of this.loops) l.stop();
    for (const n of this.noises) n.stop();
    for (const o of this.oscillators) o.stop();
  }

  setVolume(volume: number, rampTime = 0.1): void {
    this.masterGain.gain.rampTo(volume * 0.5, rampTime);
  }

  dispose(): void {
    this.stop();
    for (const l of this.loops) l.dispose();
    for (const n of this.noises) n.dispose();
    for (const o of this.oscillators) o.dispose();
    for (const s of this.noiseSynths) s.dispose();
    for (const s of this.membraneSynths) s.dispose();
    for (const f of this.filters) f.dispose();
    for (const g of this.gains) g.dispose();
    for (const t of this.tremolos) t.dispose();
    this.masterGain.dispose();
  }
}
