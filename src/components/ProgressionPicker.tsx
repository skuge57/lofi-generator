import { PROGRESSIONS } from '../engine/musicTheory';

interface ProgressionPickerProps {
  progressionId: string;
  activeChordIndex: number;
  playing: boolean;
  onChange: (id: string) => void;
}

export function ProgressionPicker({ progressionId, activeChordIndex, playing, onChange }: ProgressionPickerProps) {
  const current = PROGRESSIONS.find(p => p.id === progressionId) ?? PROGRESSIONS[0];

  return (
    <div className="progression-picker">
      <div className="prog-chord-display">
        {current.chords.map((chord, i) => (
          <span
            key={i}
            className={`chord-name ${playing && i === activeChordIndex ? 'active' : ''}`}
          >
            {chord.name}
          </span>
        ))}
      </div>

      <div className="prog-list">
        {PROGRESSIONS.map(p => (
          <button
            key={p.id}
            className={`prog-btn ${p.id === progressionId ? 'selected' : ''}`}
            onClick={() => onChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
