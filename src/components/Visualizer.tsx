interface VisualizerProps {
  playing: boolean;
  step: number;
}

const BAR_COUNT = 16;

export function Visualizer({ playing, step }: VisualizerProps) {
  return (
    <div className="visualizer">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className={`bar ${playing ? 'animate' : ''} ${playing && i === step ? 'active' : ''}`}
          style={{ animationDelay: `${(i * 0.07) % 0.6}s` }}
        />
      ))}
    </div>
  );
}
