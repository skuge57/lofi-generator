import { PROGRESSIONS, transposeChordName } from '../engine/musicTheory';
import type { SectionInfo } from '../engine/types';

interface ProgressionPickerProps {
  progressionId: string;
  activeChordIndex: number;
  playing: boolean;
  keyShift: number;
  sectionInfo: SectionInfo | null;
  onChange: (id: string) => void;
}

export function ProgressionPicker({ progressionId, activeChordIndex, playing, keyShift, sectionInfo, onChange }: ProgressionPickerProps) {
  const current = PROGRESSIONS.find(p => p.id === progressionId) ?? PROGRESSIONS[0];

  return (
    <div className="progression-picker">
      {playing && sectionInfo && (
        <div className="section-indicator">
          <span className="section-name">{sectionInfo.label}</span>
          <span className="section-progress">
            bar {sectionInfo.barInSection + 1} / {sectionInfo.totalBars}
          </span>
        </div>
      )}

      <div className="prog-chord-display">
        {current.chords.map((chord, i) => (
          <span
            key={i}
            className={`chord-name ${playing && i === activeChordIndex ? 'active' : ''}`}
          >
            {transposeChordName(chord.name, keyShift)}
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
