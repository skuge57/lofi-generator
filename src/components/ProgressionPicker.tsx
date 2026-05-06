import { PROGRESSIONS, getReharmonizedProgression, romanNumeralForChord, transposeChordName } from '../engine/musicTheory';
import type { ReharmFlavor, SectionInfo } from '../engine/types';

interface ProgressionPickerProps {
  progressionId: string;
  reharmFlavor: ReharmFlavor;
  activeChordIndex: number;
  playing: boolean;
  songForm: boolean;
  keyShift: number;
  sectionInfo: SectionInfo | null;
  onChange: (id: string) => void;
  onReharmFlavorChange: (flavor: ReharmFlavor) => void;
}

const REHARM_FLAVORS: ReharmFlavor[] = ['diatonic', 'jazzy', 'darker', 'dreamy', 'spicy'];

export function ProgressionPicker({
  progressionId,
  reharmFlavor,
  activeChordIndex,
  playing,
  songForm,
  keyShift,
  sectionInfo,
  onChange,
  onReharmFlavorChange,
}: ProgressionPickerProps) {
  const current = getReharmonizedProgression(progressionId, reharmFlavor);
  const indicatorLabel = sectionInfo?.label ?? (songForm ? 'Form ready' : 'Free loop');
  const indicatorProgress = sectionInfo
    ? `bar ${sectionInfo.barInSection + 1} / ${sectionInfo.totalBars}`
    : playing
      ? 'looping'
      : 'idle';

  return (
    <div className="progression-picker">
      <div className="section-indicator">
        <span className="section-name">{indicatorLabel}</span>
        <span className="section-progress">{indicatorProgress}</span>
      </div>

      <div className="prog-chord-display">
        {current.chords.map((chord, i) => (
          <span
            key={i}
            className={`chord-name ${playing && i === activeChordIndex ? 'active' : ''}`}
          >
            <span className="chord-symbol">{transposeChordName(chord.name, keyShift)}</span>
            <span className="chord-roman">{romanNumeralForChord(chord.name, keyShift)}</span>
          </span>
        ))}
      </div>

      <div className="reharm-row" role="group" aria-label="Chord reharmonization">
        {REHARM_FLAVORS.map(flavor => (
          <button
            key={flavor}
            type="button"
            className={`reharm-btn ${reharmFlavor === flavor ? 'active' : ''}`}
            onClick={() => onReharmFlavorChange(flavor)}
          >
            {flavor}
          </button>
        ))}
      </div>

      <div className="prog-list">
        {PROGRESSIONS.map(p => (
          <button
            key={p.id}
            className={`prog-btn ${p.id === progressionId ? 'selected' : ''}`}
            onClick={() => onChange(p.id)}
          >
            <span>{p.label}</span>
            <span className="prog-roman">{p.chords.map(chord => romanNumeralForChord(chord.name, keyShift)).join(' - ')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
