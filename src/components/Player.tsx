interface PlayerProps {
  playing: boolean;
  onToggle: () => void;
}

export function Player({ playing, onToggle }: PlayerProps) {
  return (
    <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={onToggle}>
      {playing ? (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <rect x="3" y="3" width="5" height="14" rx="1" />
          <rect x="12" y="3" width="5" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <polygon points="5,2 18,10 5,18" />
        </svg>
      )}
    </button>
  );
}
