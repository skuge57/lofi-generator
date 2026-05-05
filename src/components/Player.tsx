interface PlayerProps {
  playing: boolean;
  onToggle: () => void;
}

export function Player({ playing, onToggle }: PlayerProps) {
  return (
    <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={onToggle}>
      {playing ? '⏸' : '▶'}
    </button>
  );
}
