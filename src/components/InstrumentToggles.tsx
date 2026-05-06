import type { WheelEvent } from 'react';
import type { InstrumentMix, InstrumentVolumes } from '../engine/types';

interface InstrumentTogglesProps {
  mix: InstrumentMix;
  volume: InstrumentVolumes;
  onMixChange: (mix: InstrumentMix) => void;
  onVolumeChange: (volume: InstrumentVolumes) => void;
}

const INSTRUMENTS: { key: keyof InstrumentMix; label: string; volumeLabel: string }[] = [
  { key: 'kick',    label: 'Kick',    volumeLabel: 'Kick'    },
  { key: 'snare',   label: 'Snare',   volumeLabel: 'Snare'   },
  { key: 'hihat',   label: 'HH',      volumeLabel: 'HH'      },
  { key: 'bass',    label: 'Bass',    volumeLabel: 'Bass'    },
  { key: 'chord',   label: 'Chord',   volumeLabel: 'Chord'   },
  { key: 'melody',  label: 'Mel',     volumeLabel: 'Mel'     },
  { key: 'counter', label: 'Counter', volumeLabel: 'Counter' },
  { key: 'vinyl',   label: 'Vinyl',   volumeLabel: 'Vinyl'   },
];

function clampVolume(value: number): number {
  return Math.min(1.5, Math.max(0, Number(value.toFixed(2))));
}

export function InstrumentToggles({ mix, volume, onMixChange, onVolumeChange }: InstrumentTogglesProps) {
  function toggle(key: keyof InstrumentMix) {
    onMixChange({ ...mix, [key]: !mix[key] });
  }

  function setVolume(key: keyof InstrumentMix, value: number) {
    onVolumeChange({ ...volume, [key]: clampVolume(value) });
  }

  function handleVolumeWheel(event: WheelEvent<HTMLInputElement>, key: keyof InstrumentMix) {
    event.preventDefault();
    event.currentTarget.focus();
    const direction = event.deltaY < 0 ? 1 : -1;
    setVolume(key, volume[key] + direction * 0.05);
  }

  return (
    <div className="instrument-panel">
      <div className="instrument-toggles">
        {INSTRUMENTS.map(({ key, label }) => (
          <button
            key={key}
            className={`inst-btn ${mix[key] ? 'on' : 'off'}`}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="instrument-volume-grid">
        {INSTRUMENTS.map(({ key, volumeLabel }) => (
          <label key={key} className="instrument-volume-row">
            <span>{volumeLabel}</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={volume[key]}
              onChange={e => setVolume(key, Number(e.target.value))}
              onWheel={e => handleVolumeWheel(e, key)}
            />
            <span className="instrument-volume-val">{Math.round(volume[key] * 100)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
