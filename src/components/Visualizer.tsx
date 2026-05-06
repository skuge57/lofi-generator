import { forwardRef, useImperativeHandle, useRef } from 'react';

const BAR_COUNT = 16;
const BAR_STYLES = Array.from({ length: BAR_COUNT }, (_, i) => ({
  animationDelay: `${(i * 0.07) % 0.6}s`,
}));

export interface VisualizerHandle {
  setStep: (step: number) => void;
  reset: () => void;
}

export const Visualizer = forwardRef<VisualizerHandle, { playing: boolean }>(
  function Visualizer({ playing }, ref) {
    const barsRef = useRef<(HTMLDivElement | null)[]>(new Array(BAR_COUNT).fill(null));
    const activeRef = useRef(-1);

    useImperativeHandle(ref, () => ({
      setStep(step: number) {
        if (step === activeRef.current) return;
        const bars = barsRef.current;
        if (activeRef.current >= 0) bars[activeRef.current]?.classList.remove('active');
        bars[step]?.classList.add('active');
        activeRef.current = step;
      },
      reset() {
        const bars = barsRef.current;
        if (activeRef.current >= 0) bars[activeRef.current]?.classList.remove('active');
        activeRef.current = -1;
      },
    }));

    return (
      <div className="visualizer">
        {BAR_STYLES.map((style, i) => (
          <div
            key={i}
            ref={el => { barsRef.current[i] = el; }}
            className={`bar ${playing ? 'animate' : ''}`}
            style={style}
          />
        ))}
      </div>
    );
  }
);
