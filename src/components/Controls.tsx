import type { BassStyle, Mood, EngineParams, TimeSignature } from '../engine/types';
import { InfoTip } from './InfoTip';

interface ControlsProps {
  params: EngineParams;
  onChange: (p: Partial<EngineParams>) => void;
}

const MOODS: Mood[] = ['chill', 'sad', 'jazzy'];
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '5/4', '6/8'];
const BASS_STYLES: BassStyle[] = ['simple', 'walking', 'lazy', 'bounce', 'dub', 'pedal'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
        <input
          type="range" min={60} max={110} step={1}
          value={params.bpm}
          onChange={e => onChange({ bpm: Number(e.target.value) })}
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
      <div className="mood-row">
        {TIME_SIGNATURES.map(sig => (
          <button
            key={sig}
            className={`mood-btn ${params.timeSignature === sig ? 'active' : ''}`}
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
        <InfoTip text="Auto-arranges into sections (like verse/chorus), thins or fills drums per section, and adds short fills before transitions." />
      </div>
    </div>
  );
}

export function RightControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls">
      <span className="section-label">Tone</span>
      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Reverb</span>
        </span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.reverb}
          onChange={e => onChange({ reverb: Number(e.target.value) })}
        />
        <span className="val">{params.reverb.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Vinyl</span>
          <InfoTip text="Layer of filtered noise for crackle and dust—classic lo-fi texture on top of the mix." />
        </span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.vinyl}
          onChange={e => onChange({ vinyl: Number(e.target.value) })}
        />
        <span className="val">{params.vinyl.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Tape</span>
          <InfoTip text="Tape-style wow and flutter: slow pitch wobble and shimmer, like an old cassette deck." />
        </span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.tape}
          onChange={e => onChange({ tape: Number(e.target.value) })}
        />
        <span className="val">{params.tape.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Low cut</span>
          <InfoTip text="High-pass filter frequency. Higher values remove more low rumble and mud, leaving a lighter mix." />
        </span>
        <input
          type="range" min={20} max={500} step={1}
          value={params.lowCut}
          onChange={e => onChange({ lowCut: Number(e.target.value) })}
        />
        <span className="val">{fmtHz(params.lowCut)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">High cut</span>
          <InfoTip text="Low-pass filter frequency. Lower values darken the mix by rolling off treble and air." />
        </span>
        <input
          type="range" min={500} max={18000} step={50}
          value={params.highCut}
          onChange={e => onChange({ highCut: Number(e.target.value) })}
        />
        <span className="val">{fmtHz(params.highCut)}</span>
      </label>

      <span className="section-label">Feel</span>
      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Timing</span>
          <InfoTip text="Humanizes note onsets: random tiny delays on chords and melody. Higher values sound looser and more laid-back." />
        </span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.chordTiming}
          onChange={e => onChange({ chordTiming: Number(e.target.value) })}
        />
        <span className="val">{Math.round(params.chordTiming * 100)}%</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Chord</span>
          <InfoTip text="How long each chord pad rings out (note duration in seconds). Shorter feels stabby; longer feels washed out." />
        </span>
        <input
          type="range" min={0.05} max={4} step={0.05}
          value={params.chordLength}
          onChange={e => onChange({ chordLength: Number(e.target.value) })}
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
        <input
          type="range" min={0} max={1} step={0.05}
          value={params.drumProb.kick}
          onChange={e => onChange({ drumProb: { ...params.drumProb, kick: Number(e.target.value) } })}
        />
        <span className="val">{Math.round(params.drumProb.kick * 100)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">Snare %</span>
          <InfoTip text="Probability snare/backbeat hits fire. Lower values drop backbeats for a softer pocket." />
        </span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={params.drumProb.snare}
          onChange={e => onChange({ drumProb: { ...params.drumProb, snare: Number(e.target.value) } })}
        />
        <span className="val">{Math.round(params.drumProb.snare * 100)}</span>
      </label>

      <label className="slider-row">
        <span className="slider-label">
          <span className="slider-label-text">HH %</span>
          <InfoTip text="Probability hi-hat ticks fire. Lower values thin out hats for more air between hits." />
        </span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={params.drumProb.hihat}
          onChange={e => onChange({ drumProb: { ...params.drumProb, hihat: Number(e.target.value) } })}
        />
        <span className="val">{Math.round(params.drumProb.hihat * 100)}</span>
      </label>
    </div>
  );
}
