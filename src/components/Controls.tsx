import type { Mood, EngineParams } from '../engine/types';

interface ControlsProps {
  params: EngineParams;
  onChange: (p: Partial<EngineParams>) => void;
}

const MOODS: Mood[] = ['chill', 'sad', 'jazzy'];
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

      <span className="section-label">Key</span>
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
    </div>
  );
}

export function RightControls({ params, onChange }: ControlsProps) {
  return (
    <div className="controls">
      <label className="slider-row">
        <span>Reverb</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.reverb}
          onChange={e => onChange({ reverb: Number(e.target.value) })}
        />
        <span className="val">{params.reverb.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span>Vinyl</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.vinyl}
          onChange={e => onChange({ vinyl: Number(e.target.value) })}
        />
        <span className="val">{params.vinyl.toFixed(2)}</span>
      </label>

      <label className="slider-row">
        <span>Low cut</span>
        <input
          type="range" min={20} max={500} step={1}
          value={params.lowCut}
          onChange={e => onChange({ lowCut: Number(e.target.value) })}
        />
        <span className="val">{fmtHz(params.lowCut)}</span>
      </label>

      <label className="slider-row">
        <span>High cut</span>
        <input
          type="range" min={500} max={18000} step={50}
          value={params.highCut}
          onChange={e => onChange({ highCut: Number(e.target.value) })}
        />
        <span className="val">{fmtHz(params.highCut)}</span>
      </label>

      <label className="slider-row">
        <span>Timing</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={params.chordTiming}
          onChange={e => onChange({ chordTiming: Number(e.target.value) })}
        />
        <span className="val">{Math.round(params.chordTiming * 100)}%</span>
      </label>

      <label className="slider-row">
        <span>Chord</span>
        <input
          type="range" min={0.05} max={4} step={0.05}
          value={params.chordLength}
          onChange={e => onChange({ chordLength: Number(e.target.value) })}
        />
        <span className="val">{params.chordLength.toFixed(1)}s</span>
      </label>

      <div className="slider-row">
        <span>Octave</span>
        <div className="octave-btns">
          <button
            className="oct-btn"
            disabled={params.octaveShift <= -2}
            onClick={() => onChange({ octaveShift: params.octaveShift - 1 })}
          >−</button>
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
        <span>Mel oct</span>
        <div className="octave-btns">
          <button
            className="oct-btn"
            disabled={params.melodyOctave <= -1}
            onClick={() => onChange({ melodyOctave: params.melodyOctave - 1 })}
          >−</button>
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

      <span className="section-label">Bass</span>
      <div className="mood-row">
        <button
          className={`mood-btn ${params.bassStyle === 'simple' ? 'active' : ''}`}
          onClick={() => onChange({ bassStyle: 'simple' })}
        >
          simple
        </button>
        <button
          className={`mood-btn ${params.bassStyle === 'walking' ? 'active' : ''}`}
          onClick={() => onChange({ bassStyle: 'walking' })}
        >
          walking
        </button>
      </div>

      <span className="section-label">Drums</span>

      <label className="slider-row">
        <span>Kick %</span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={params.drumProb.kick}
          onChange={e => onChange({ drumProb: { ...params.drumProb, kick: Number(e.target.value) } })}
        />
        <span className="val">{Math.round(params.drumProb.kick * 100)}</span>
      </label>

      <label className="slider-row">
        <span>Snare %</span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={params.drumProb.snare}
          onChange={e => onChange({ drumProb: { ...params.drumProb, snare: Number(e.target.value) } })}
        />
        <span className="val">{Math.round(params.drumProb.snare * 100)}</span>
      </label>

      <label className="slider-row">
        <span>HH %</span>
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
