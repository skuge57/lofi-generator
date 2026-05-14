import { useEffect, useRef } from 'react';
import { BASS_STYLES } from '../engine/types';
import type { BassStyle, ChordVoice, DrumKit, Mood, EngineParams, SceneId, TimeSignature } from '../engine/types';
import { SCENES } from '../engine/sceneEngine';
import { InfoTip } from './InfoTip';

interface ControlsProps {
  params: EngineParams;
  onChange: (p: Partial<EngineParams>) => void;
}

export interface LeftControlsProps extends ControlsProps {
  sceneId: SceneId | null;
  sceneVolume: number;
  onSceneChange: (id: SceneId | null) => void;
  onSceneVolumeChange: (v: number) => void;
}

const MOODS: Mood[] = ['chill', 'sad', 'jazzy', 'dreamy', 'rainy', 'dusty', 'upbeat', 'sleepy'];
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '5/4', '6/8'];
const BASS_STYLE_LABELS: Record<BassStyle, string> = {
  'root-only': 'Root',
  'synth-sub': 'Sub',
  dub: 'Dub',
  'lazy-guitarist': 'Lazy',
  'walking-jazz': 'Walk',
  upright: 'Upright',
  'off-grid': 'Off grid',
};
const DRUM_KITS: { value: DrumKit; label: string }[] = [
  { value: 'synth', label: 'Synth' },
  { value: 'sample', label: 'Samples' },
];
const CHORD_VOICES: { value: ChordVoice; label: string }[] = [
  { value: 'rhodes', label: 'Rhodes' },
  { value: 'wurlitzer', label: 'Wurli' },
  { value: 'muted-guitar', label: 'Guitar' },
  { value: 'vibraphone', label: 'Vibes' },
  { value: 'tape-choir', label: 'Choir' },
  { value: 'juno-strings', label: 'Strings' },
  { value: 'organ', label: 'Organ' },
  { value: 'glass-pad', label: 'Glass' },
];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
interface WheelRangeProps {
  min: number;
  max: number;
  step: number;
  value: number;
  wheelStep?: number;
  enableWheel?: boolean;
  onValueChange: (value: number) => void;
}

function decimalPlaces(value: number): number {
  const [, decimal = ''] = value.toString().split('.');
  return decimal.length;
}

function clampRangeValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Number(clamped.toFixed(decimalPlaces(step)));
}

export function WheelRange({ min, max, step, value, wheelStep = step, enableWheel = true, onValueChange }: WheelRangeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !enableWheel) return;

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      input.focus();
      const direction = event.deltaY < 0 ? 1 : -1;
      const nextValue = clampRangeValue(value + direction * wheelStep, min, max, step);
      if (nextValue !== value) {
        onValueChange(nextValue);
      }
    };

    input.addEventListener('wheel', handleWheel, { passive: false });
    return () => input.removeEventListener('wheel', handleWheel);
  }, [enableWheel, max, min, onValueChange, step, value, wheelStep]);

  return (
    <input
      ref={inputRef}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onValueChange(Number(e.target.value))}
    />
  );
}

function fmtHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function macroPercent(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function macroFromRange(value: number, min: number, max: number, invert = false): number {
  const normalized = clamp01((value - min) / (max - min));
  return invert ? 1 - normalized : normalized;
}

function macroVolume(
  volume: EngineParams['instrumentVolume'],
  updates: Partial<EngineParams['instrumentVolume']>
): EngineParams['instrumentVolume'] {
  return { ...volume, ...updates };
}

function macroMix(
  mix: EngineParams['mix'],
  updates: Partial<EngineParams['mix']>
): EngineParams['mix'] {
  return { ...mix, ...updates };
}

const MACROS = [
  {
    key: 'warmth',
    label: 'Warmth',
    tip: 'Adds tape weight, trims brittle top end, and gently lifts chords and bass.',
    value: (p: EngineParams) => macroFromRange(p.tape, 0.12, 0.8),
    update: (p: EngineParams, v: number): Partial<EngineParams> => ({
      tape: round2(0.12 + v * 0.68),
      highCut: Math.round(15000 - v * 9500),
      lowCut: Math.round(80 - v * 36),
      instrumentVolume: macroVolume(p.instrumentVolume, {
        chord: round2(0.88 + v * 0.24),
        bass: round2(0.92 + v * 0.2),
      }),
    }),
  },
  {
    key: 'dust',
    label: 'Dust',
    tip: 'Raises vinyl crackle, brings the vinyl layer in, and adds a small amount of crush.',
    value: (p: EngineParams) => macroFromRange(p.vinyl, 0.08, 0.86),
    update: (p: EngineParams, v: number): Partial<EngineParams> => ({
      vinyl: round2(0.08 + v * 0.78),
      crush: round2(v * 0.22),
      mix: macroMix(p.mix, { vinyl: v > 0.03 }),
      instrumentVolume: macroVolume(p.instrumentVolume, { vinyl: round2(0.45 + v * 0.75) }),
    }),
  },
  {
    key: 'space',
    label: 'Space',
    tip: 'Opens the reverb send, lengthens chords, and lets melody layers sit farther back.',
    value: (p: EngineParams) => macroFromRange(p.reverb, 0.18, 0.94),
    update: (p: EngineParams, v: number): Partial<EngineParams> => ({
      reverb: round2(0.18 + v * 0.76),
      chordLength: round2(0.55 + v * 2.45),
      instrumentVolume: macroVolume(p.instrumentVolume, {
        melody: round2(1.08 - v * 0.18),
        counter: round2(0.9 - v * 0.12),
      }),
    }),
  },
  {
    key: 'movement',
    label: 'Movement',
    tip: 'Pushes swing, tape wobble, ducking, and section energy so the beat breathes more.',
    value: (p: EngineParams) => macroFromRange(p.energy, 32, 96),
    update: (_p: EngineParams, v: number): Partial<EngineParams> => ({
      swing: round2(v * 0.46),
      tape: round2(0.08 + v * 0.7),
      energy: Math.round(32 + v * 64),
      sidechainDucking: v > 0.18,
    }),
  },
  {
    key: 'complexity',
    label: 'Complexity',
    tip: 'Brings in melody support, denser hats, stronger energy, and busier bass behavior.',
    value: (p: EngineParams) => macroFromRange(p.energy, 28, 98),
    update: (p: EngineParams, v: number): Partial<EngineParams> => ({
      energy: Math.round(28 + v * 70),
      bassStyle: v > 0.72 ? 'walking-jazz' : v > 0.46 ? 'upright' : v > 0.22 ? 'lazy-guitarist' : 'root-only',
      drumProb: {
        kick: round2(0.72 + v * 0.28),
        snare: round2(0.66 + v * 0.34),
        hihat: round2(0.4 + v * 0.6),
      },
      mix: macroMix(p.mix, {
        melody: v > 0.15,
        counter: v > 0.48,
      }),
      instrumentVolume: macroVolume(p.instrumentVolume, {
        melody: round2(0.72 + v * 0.48),
        counter: round2(0.52 + v * 0.42),
      }),
    }),
  },
  {
    key: 'darkness',
    label: 'Darkness',
    tip: 'Rolls off treble, raises low filtering slightly, and leans reharmonization darker.',
    value: (p: EngineParams) => macroFromRange(p.highCut, 16000, 2800, true),
    update: (_p: EngineParams, v: number): Partial<EngineParams> => ({
      highCut: Math.round(16000 - v * 13200),
      lowCut: Math.round(45 + v * 120),
      reharmFlavor: v > 0.68 ? 'darker' : v > 0.42 ? 'jazzy' : 'diatonic',
    }),
  },
  {
    key: 'humanFeel',
    label: 'Human feel',
    tip: 'Adds timing looseness, shuffle, softer drum certainty, and guitar-like pad voicing at high settings.',
    value: (p: EngineParams) => macroFromRange(p.chordTiming, 0.04, 0.76),
    update: (_p: EngineParams, v: number): Partial<EngineParams> => {
      const update: Partial<EngineParams> = {
        chordTiming: round2(0.04 + v * 0.72),
        swing: round2(v * 0.38),
        chordLength: round2(0.72 + v * 1.75),
        drumProb: {
          kick: round2(0.98 - v * 0.16),
          snare: round2(0.96 - v * 0.2),
          hihat: round2(0.9 - v * 0.28),
        },
      };
      if (v > 0.78) update.chordVoice = 'muted-guitar';
      if (v > 0.82) update.bassStyle = 'off-grid';
      return update;
    },
  },
] as const;

export function MacroControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls macro-controls">
      <span className="section-label section-label-row">
        <span>Macros</span>
        <InfoTip text="High-level controls that move several detailed settings together. Advanced controls remain editable afterward." />
      </span>
      <div className="macro-grid">
        {MACROS.map(macro => {
          const value = macro.value(params);
          return (
            <label key={macro.key} className="macro-row">
              <span className="macro-label">
                <span className="slider-label-text">{macro.label}</span>
                <InfoTip text={macro.tip} />
              </span>
              <WheelRange
                min={0} max={1} step={0.01}
                value={round2(value)}
                wheelStep={0.05}
                onValueChange={next => onChange(macro.update(params, next))}
              />
              <span className="macro-val">{macroPercent(value)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function SimpleControls({ params, onChange }: ControlsProps) {
  return (
    <div className="simple-panel">
      <div className="controls simple-controls">
        <span className="section-label section-label-row">
          <span>Mood</span>
          <InfoTip text="Pick the overall rhythmic and harmonic feel for the beat." />
        </span>
        <div className="mood-row">
          {MOODS.map(m => (
            <button
              key={m}
              className={`mood-btn ${params.mood === m ? 'active' : ''}`}
              onClick={() => onChange({ mood: m })}
            >
              {m}
            </button>
          ))}
        </div>

        <span className="section-label section-label-row">
          <span>Key</span>
          <InfoTip text="Transposes chords and melody together." />
        </span>
        <div className="key-row">
          {NOTE_NAMES.map((note, i) => (
            <button
              key={note}
              className={`key-btn ${params.keyShift === i ? 'active' : ''}`}
              onClick={() => onChange({ keyShift: i })}
            >
              {note}
            </button>
          ))}
        </div>

        <label className="slider-row simple-slider-row">
          <span className="slider-label">
            <span className="slider-label-text">Energy</span>
            <InfoTip text="Overall arrangement intensity: density, brightness, hats, and melody activity." />
          </span>
          <WheelRange
            min={0} max={100} step={1}
            value={params.energy}
            wheelStep={5}
            onValueChange={energy => onChange({ energy })}
          />
          <span className="val">{params.energy}</span>
        </label>

        <label className="slider-row simple-slider-row">
          <span className="slider-label">
            <span className="slider-label-text">Volume</span>
            <InfoTip text="Final output level after the limiter." />
          </span>
          <WheelRange
            min={0} max={2} step={0.01}
            value={params.masterVolume}
            wheelStep={0.05}
            onValueChange={masterVolume => onChange({ masterVolume })}
          />
          <span className="val">{Math.round(params.masterVolume * 100)}%</span>
        </label>
      </div>
      <MacroControls params={params} onChange={onChange} />
    </div>
  );
}

export function LeftControls({ params, onChange, sceneId, sceneVolume, onSceneChange, onSceneVolumeChange }: LeftControlsProps) {
  return (
    <div className="controls">
      <div className="mood-row">
        {MOODS.map(m => (
          <button
            key={m}
            className={`mood-btn ${params.mood === m ? 'active' : ''}`}
            onClick={() => onChange({ mood: m })}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="slider-row">
        <span>BPM</span>
        <WheelRange
          min={60} max={110} step={1}
          value={params.bpm}
          onValueChange={bpm => onChange({ bpm })}
        />
        <span className="val">{params.bpm}</span>
      </label>

      <span className="section-label section-label-row">
        <span>Key</span>
        <InfoTip text="Transposes chords and melody together—the same progression in a different key." />
      </span>
      <div className="key-row">
        {NOTE_NAMES.map((note, i) => (
          <button
            key={note}
            className={`key-btn ${params.keyShift === i ? 'active' : ''}`}
            onClick={() => onChange({ keyShift: i })}
          >
            {note}
          </button>
        ))}
      </div>

      <span className="section-label section-label-row">
        <span>Arrangement</span>
        <InfoTip text="Beats per bar and how strong the downbeat feels. Odd meters like 5/4 or 6/8 add sway compared to straight 4/4." />
      </span>
      <div className="time-signature-row" role="group" aria-label="Time signature">
        {TIME_SIGNATURES.map(sig => (
          <button
            key={sig}
            type="button"
            className={`time-signature-btn ${params.timeSignature === sig ? 'active' : ''}`}
            onClick={() => onChange({ timeSignature: sig })}
          >
            {sig}
          </button>
        ))}
      </div>

      <div className="song-form-row">
        <button
          className={`song-form-btn ${params.songForm ? 'active' : ''}`}
          onClick={() => onChange({ songForm: !params.songForm })}
        >
          Song form: {params.songForm ? 'on' : 'off'}
        </button>
        <InfoTip text="Auto-arranges into sections, evolves energy by section, and adds short fills before transitions." />
      </div>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Energy</span>
          <InfoTip text="Overall arrangement intensity. Song form uses it as the ceiling for section density, brightness, hats, and melody activity." />
        </span>
        <WheelRange
          min={0} max={100} step={1}
          value={params.energy}
          wheelStep={5}
          onValueChange={energy => onChange({ energy })}
        />
        <span className="val">{params.energy}</span>
      </label>

      <div className="seed-row">
        <span className="seed-label">Seed</span>
        <input
          type="text"
          className="seed-input"
          placeholder="Random"
          value={params.seed ?? ''}
          onChange={e => onChange({ seed: e.target.value ? e.target.value : undefined })}
          spellCheck={false}
        />
        <InfoTip text="Same seed + same arrangement reproduces the same beat (great for sharing links). Leave empty for fresh randomness each play." />
      </div>

      <span className="section-label section-label-row">
        <span>Scene</span>
        <InfoTip text="Layer procedural ambience over the beat. Each scene generates unique sounds: vinyl crackle, rain, café murmur, train, street traffic, fireplace, or late-night room tone." />
      </span>
      <div className="scene-row">
        <button
          type="button"
          className={`mood-btn scene-btn ${sceneId === null ? 'active' : ''}`}
          onClick={() => onSceneChange(null)}
        >
          off
        </button>
        {SCENES.map(s => (
          <button
            key={s.id}
            type="button"
            className={`mood-btn scene-btn ${sceneId === s.id ? 'active' : ''}`}
            onClick={() => onSceneChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sceneId !== null && (
        <label className="slider-row">
          <span>Level</span>
          <WheelRange
            min={0} max={1} step={0.01}
            value={sceneVolume}
            wheelStep={0.05}
            onValueChange={onSceneVolumeChange}
          />
          <span className="val">{Math.round(sceneVolume * 100)}%</span>
        </label>
      )}
    </div>
  );
}

export function RightControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls">
      <span className="section-label">Tone</span>
      <span className="section-label section-label-row">
        <span>Pad voice</span>
        <InfoTip text="Chooses the chord instrument: keys, guitar, vibes, tape choir, strings, organ, or glassy FM pad." />
      </span>
      <div className="chord-voice-grid" role="group" aria-label="Chord pad voice">
        {CHORD_VOICES.map(voice => (
          <button
            key={voice.value}
            type="button"
            className={`mood-btn chord-voice-btn ${params.chordVoice === voice.value ? 'active' : ''}`}
            onClick={() => onChange({ chordVoice: voice.value })}
          >
            {voice.label}
          </button>
        ))}
      </div>

      <div className="song-form-row">
        <button
          className={`song-form-btn ${params.voiceLeading ? 'active' : ''}`}
          onClick={() => onChange({ voiceLeading: !params.voiceLeading })}
        >
          Voice leading: {params.voiceLeading ? 'on' : 'off'}
        </button>
        <InfoTip text="Chooses close chord inversions so pad voices move by smaller steps between changes." />
      </div>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Master</span>
          <InfoTip text="Final output level after the limiter. Use it to trim down or lift the whole mix." />
        </span>
        <WheelRange
          min={0} max={2} step={0.01}
          value={params.masterVolume}
          wheelStep={0.05}
          onValueChange={masterVolume => onChange({ masterVolume })}
        />
        <span className="val">{Math.round(params.masterVolume * 100)}%</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Reverb</span>
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.reverb}
          onValueChange={reverb => onChange({ reverb })}
        />
        <span className="val">{params.reverb.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Vinyl</span>
          <InfoTip text="Layered vinyl bed with filtered dust, intermittent clicks, soft pops, and brief dropouts." />
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.vinyl}
          onValueChange={vinyl => onChange({ vinyl })}
        />
        <span className="val">{params.vinyl.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Tape</span>
          <InfoTip text="Tape-style wow and flutter: slow pitch wobble and shimmer, like an old cassette deck." />
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.tape}
          onValueChange={tape => onChange({ tape })}
        />
        <span className="val">{params.tape.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Crush</span>
          <InfoTip text="Master bitcrusher for optional lo-fi destruction. Higher values lower bit depth and blend in more crunchy aliasing." />
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.crush}
          onValueChange={crush => onChange({ crush })}
        />
        <span className="val">{params.crush.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Low cut</span>
          <InfoTip text="High-pass filter frequency. Higher values remove more low rumble and mud, leaving a lighter mix." />
        </span>
        <WheelRange
          min={20} max={500} step={1}
          value={params.lowCut}
          wheelStep={10}
          onValueChange={lowCut => onChange({ lowCut })}
        />
        <span className="val">{fmtHz(params.lowCut)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">High cut</span>
          <InfoTip text="Low-pass filter frequency. Lower values darken the mix by rolling off treble and air." />
        </span>
        <WheelRange
          min={500} max={18000} step={50}
          value={params.highCut}
          wheelStep={250}
          onValueChange={highCut => onChange({ highCut })}
        />
        <span className="val">{fmtHz(params.highCut)}</span>
      </label>

      <span className="section-label">Feel</span>
      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Timing</span>
          <InfoTip text="Humanizes note onsets: random tiny delays on chords and melody. Higher values sound looser and more laid-back." />
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.chordTiming}
          wheelStep={0.05}
          onValueChange={chordTiming => onChange({ chordTiming })}
        />
        <span className="val">{Math.round(params.chordTiming * 100)}%</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Swing</span>
          <InfoTip text="Delays every other 16th note for a shuffle feel. Higher values push off-beats later in the pocket." />
        </span>
        <WheelRange
          min={0} max={1} step={0.01}
          value={params.swing}
          wheelStep={0.05}
          onValueChange={swing => onChange({ swing })}
        />
        <span className="val">{Math.round(params.swing * 100)}%</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Chord</span>
          <InfoTip text="How long each chord pad rings out (note duration in seconds). Shorter feels stabby; longer feels washed out." />
        </span>
        <WheelRange
          min={0.05} max={4} step={0.05}
          value={params.chordLength}
          onValueChange={chordLength => onChange({ chordLength })}
        />
        <span className="val">{params.chordLength.toFixed(1)}s</span>
      </label>

      <div className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Octave</span>
          <InfoTip text="Shifts the chord pad voicings up or down in octaves. Bass and lead melody keep their own register unless you change Mel oct." />
        </span>
        <div className="octave-btns">
          <button
            className="oct-btn"
            disabled={params.octaveShift <= -2}
            onClick={() => onChange({ octaveShift: params.octaveShift - 1 })}
          >-</button>
          <span className="oct-val">
            {params.octaveShift > 0 ? `+${params.octaveShift}` : params.octaveShift}
          </span>
          <button
            className="oct-btn"
            disabled={params.octaveShift >= 2}
            onClick={() => onChange({ octaveShift: params.octaveShift + 1 })}
          >+</button>
        </div>
        <span className="val" />
      </div>

      <div className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Mel oct</span>
          <InfoTip text="Moves only the lead melody (and its harmony line) up or down an octave, independent of the rest of the arrangement." />
        </span>
        <div className="octave-btns">
          <button
            className="oct-btn"
            disabled={params.melodyOctave <= -1}
            onClick={() => onChange({ melodyOctave: params.melodyOctave - 1 })}
          >-</button>
          <span className="oct-val">
            {params.melodyOctave > 0 ? `+${params.melodyOctave}` : params.melodyOctave}
          </span>
          <button
            className="oct-btn"
            disabled={params.melodyOctave >= 2}
            onClick={() => onChange({ melodyOctave: params.melodyOctave + 1 })}
          >+</button>
        </div>
        <span className="val" />
      </div>

    </div>
  );
}

export function RhythmControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls rhythm-controls">
      <span className="section-label section-label-row">
        <span>Bass</span>
        <InfoTip text="Bass player personality: Root stays minimal; Sub pulses low roots; Dub leaves space; Lazy drags roots and fifths; Walk outlines jazz changes; Upright adds softer quarter-note motion; Off grid plays loose and uneven." />
      </span>
      <div className="bass-style-grid" role="group" aria-label="Bass style">
        {BASS_STYLES.map(style => (
          <button
            key={style}
            type="button"
            className={`mood-btn bass-style-btn ${params.bassStyle === style ? 'active' : ''}`}
            onClick={() => onChange({ bassStyle: style })}
          >
            {BASS_STYLE_LABELS[style]}
          </button>
        ))}
      </div>

      <div className="song-form-row">
        <button
          className={`song-form-btn ${params.sidechainDucking ? 'active' : ''}`}
          onClick={() => onChange({ sidechainDucking: !params.sidechainDucking })}
        >
          Sidechain: {params.sidechainDucking ? 'on' : 'off'}
        </button>
        <InfoTip text="Kick-triggered ducking on the chord pad and bass for a gentle lo-fi pump." />
      </div>

      <span className="section-label section-label-row">
        <span>Drums</span>
        <InfoTip text="Choose the drum source, then shape how often pattern hits fire. Synth is the original generated kit; Samples uses the loaded drum files." />
      </span>

      <div className="drum-kit-row" role="group" aria-label="Drum source">
        {DRUM_KITS.map(kit => (
          <button
            key={kit.value}
            type="button"
            className={`mood-btn drum-kit-btn ${params.drumKit === kit.value ? 'active' : ''}`}
            onClick={() => onChange({ drumKit: kit.value })}
          >
            {kit.label}
          </button>
        ))}
      </div>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Kick %</span>
          <InfoTip text="Probability the kick plays on patterned kick steps. Turn down for lighter or broken grooves." />
        </span>
        <WheelRange
          min={0} max={1} step={0.05}
          value={params.drumProb.kick}
          onValueChange={kick => onChange({ drumProb: { ...params.drumProb, kick } })}
        />
        <span className="val">{Math.round(params.drumProb.kick * 100)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Snare %</span>
          <InfoTip text="Probability snare/backbeat hits fire. Lower values drop backbeats for a softer pocket." />
        </span>
        <WheelRange
          min={0} max={1} step={0.05}
          value={params.drumProb.snare}
          onValueChange={snare => onChange({ drumProb: { ...params.drumProb, snare } })}
        />
        <span className="val">{Math.round(params.drumProb.snare * 100)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">HH %</span>
          <InfoTip text="Probability hi-hat ticks fire. Lower values thin out hats for more air between hits." />
        </span>
        <WheelRange
          min={0} max={1} step={0.05}
          value={params.drumProb.hihat}
          onValueChange={hihat => onChange({ drumProb: { ...params.drumProb, hihat } })}
        />
        <span className="val">{Math.round(params.drumProb.hihat * 100)}</span>
      </label>
    </div>
  );
}
