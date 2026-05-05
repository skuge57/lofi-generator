import type { InstrumentMix } from '../engine/types';

interface InstrumentTogglesProps {
  mix: InstrumentMix;
  onChange: (mix: InstrumentMix) => void;
}

const INSTRUMENTS: { key: keyof InstrumentMix; label: string }[] = [
  { key: 'kick',   label: 'Kick'   },
  { key: 'snare',  label: 'Snare'  },
  { key: 'hihat',  label: 'HH'     },
  { key: 'bass',   label: 'Bass'   },
  { key: 'chord',  label: 'Chord'  },
  { key: 'melody', label: 'Mel'    },
  { key: 'vinyl',  label: 'Vinyl'  },
];

export function InstrumentToggles({ mix, onChange }: InstrumentTogglesProps) {
  function toggle(key: keyof InstrumentMix) {
    onChange({ ...mix, [key]: !mix[key] });
  }

  return (
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
  );
}
