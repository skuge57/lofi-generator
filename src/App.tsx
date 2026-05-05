import { useState, useRef, useCallback, useEffect } from 'react';
import { LofiEngine } from './engine/lofiEngine';
import { Player } from './components/Player';
import { Controls } from './components/Controls';
import { InstrumentToggles } from './components/InstrumentToggles';
import { ProgressionPicker } from './components/ProgressionPicker';
import { Visualizer } from './components/Visualizer';
import type { EngineParams, InstrumentMix } from './engine/types';
import './App.css';

const DEFAULT_MIX: InstrumentMix = {
  chord: true, bass: true, kick: true, snare: true, hihat: true, vinyl: true, melody: true,
};

const DEFAULT_PARAMS: EngineParams = {
  bpm: 85,
  mood: 'chill',
  progressionId: 'warm-evening',
  reverb: 0.5,
  vinyl: 0.3,
  lowCut: 60,
  highCut: 8000,
  mix: DEFAULT_MIX,
  octaveShift: 0,
  melodyOctave: 0,
  chordLength: 1.5,
  chordTiming: 0.3,
  drumProb: { kick: 1, snare: 1, hihat: 1 },
};

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<EngineParams>(DEFAULT_PARAMS);
  const [step, setStep] = useState(0);
  const [chordIndex, setChordIndex] = useState(0);
  const engineRef = useRef<LofiEngine | null>(null);
  const rafRef = useRef<number>(0);

  const trackStep = useCallback(() => {
    if (engineRef.current) {
      setStep(engineRef.current.getStep());
      setChordIndex(engineRef.current.getChordIndex());
    }
    rafRef.current = requestAnimationFrame(trackStep);
  }, []);

  const handleToggle = async () => {
    if (playing) {
      engineRef.current?.stop();
      engineRef.current?.dispose();
      engineRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      const engine = new LofiEngine(params);
      engineRef.current = engine;
      await engine.start();
      rafRef.current = requestAnimationFrame(trackStep);
      setPlaying(true);
    }
  };

  const handleParamChange = useCallback((update: Partial<EngineParams>) => {
    setParams(prev => {
      const next = { ...prev, ...update };
      engineRef.current?.updateParams(update);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="app">
      <h1 className="title">lofi.</h1>
      <Player playing={playing} onToggle={handleToggle} />
      <Controls params={params} onChange={handleParamChange} />
      <InstrumentToggles
        mix={params.mix}
        onChange={mix => handleParamChange({ mix })}
      />
      <ProgressionPicker
        progressionId={params.progressionId}
        activeChordIndex={chordIndex}
        playing={playing}
        onChange={id => handleParamChange({ progressionId: id })}
      />
      <Visualizer playing={playing} step={step} />
    </div>
  );
}
