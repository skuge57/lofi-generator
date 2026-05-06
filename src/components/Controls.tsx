import type { WheelEvent } from 'react';
import type { BassStyle, ChordVoice, Mood, EngineParams, TimeSignature } from '../engine/types';
import { InfoTip } from './InfoTip';

interface ControlsProps {
  params: EngineParams;
  onChange: (p: Partial<EngineParams>) => void;
}

const MOODS: Mood[] = ['chill', 'sad', 'jazzy', 'dreamy', 'rainy', 'dusty', 'upbeat', 'sleepy'];
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '5/4', '6/8'];
const BASS_STYLES: BassStyle[] = ['simple', 'walking', 'lazy', 'bounce', 'dub', 'pedal'];
const CHORD_VOICES: { value: ChordVoice; label: string }[] = [
  { value: 'rhodes', label: 'Rhodes' },
  { value: 'wurlitzer', label: 'Wurli' },
  { value: 'muted-guitar', label: 'Guitar' },
  { value: 'vibraphone', label: 'Vibes' },
];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
interface WheelRangeProps {
  min: number;
  max: number;
  step: number;
  value: number;
  wheelStep?: number;
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

function WheelRange({ min, max, step, value, wheelStep = step, onValueChange }: WheelRangeProps) {
  const handleWheel = (event: WheelEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    const direction = event.deltaY < 0 ? 1 : -1;
    const nextValue = clampRangeValue(value + direction * wheelStep, min, max, step);
    if (nextValue !== value) {
      onValueChange(nextValue);
    }
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onValueChange(Number(e.target.value))}
      onWheel={handleWheel}
    />
  );
}

function fmtHz(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`;
}

export function LeftControls({ params, onChange }: ControlsProps) {
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
    </div>
  );
}

export function RightControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls">
      <span className="section-label">Tone</span>
      <span className="section-label section-label-row">
        <span>Pad voice</span>
        <InfoTip text="Chooses the chord instrument: warm Rhodes, brighter Wurlitzer, short muted guitar, or bell-like vibraphone." />
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

      <span className="section-label section-label-row">
        <span>Bass</span>
        <InfoTip text="Bass line vocabulary: Simple is roots/fifths; Walking outlines changes; Lazy uses long notes; Bounce is syncopated; Dub leaves space; Pedal hammers the root with accents." />
      </span>
      <div className="bass-style-grid" role="group" aria-label="Bass style">
        {BASS_STYLES.map(style => (
          <button
            key={style}
            type="button"
            className={`mood-btn bass-style-btn ${params.bassStyle === style ? 'active' : ''}`}
            onClick={() => onChange({ bassStyle: style })}
          >
            {style}
          </button>
        ))}
      </div>

      <span className="section-label section-label-row">
        <span>Drums</span>
        <InfoTip text="Each slider is the chance that drum hits actually fire when the pattern asks for them. Lower values thin out the beat randomly." />
      </span>

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
