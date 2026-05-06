import { useState, useRef, useCallback, useEffect } from 'react';
import { LofiEngine } from './engine/lofiEngine';
import { Player } from './components/Player';
import { LeftControls, RightControls } from './components/Controls';
import { InstrumentToggles } from './components/InstrumentToggles';
import { ProgressionPicker } from './components/ProgressionPicker';
import type { EngineParams, InstrumentMix, SectionInfo } from './engine/types';
import './App.css';

const DEFAULT_MIX: InstrumentMix = {
  chord: true, bass: true, kick: true, snare: true, hihat: true, vinyl: true, melody: true, counter: true,
};

const DEFAULT_PARAMS: EngineParams = {
  bpm: 85,
  mood: 'chill',
  progressionId: 'warm-evening',
  reverb: 0.5,
  vinyl: 0.3,
  tape: 0.35,
  lowCut: 60,
  highCut: 8000,
  mix: DEFAULT_MIX,
  octaveShift: 0,
  melodyOctave: 0,
  chordLength: 1.5,
  chordTiming: 0.3,
  drumProb: { kick: 1, snare: 1, hihat: 1 },
  keyShift: 0,
  bassStyle: 'simple',
  songForm: false,
  timeSignature: '4/4',
};

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<EngineParams>(DEFAULT_PARAMS);
  const [chordIndex, setChordIndex] = useState(0);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const engineRef = useRef<LofiEngine | null>(null);
  const rafRef = useRef<number>(0);
  const prevChordRef = useRef(-1);
  const prevSectionKeyRef = useRef('');

  function trackStep() {
    if (engineRef.current) {
      const c = engineRef.current.getChordIndex();
      if (c !== prevChordRef.current) { prevChordRef.current = c; setChordIndex(c); }
      const s = engineRef.current.getSectionInfo();
      const key = s ? `${s.index}:${s.barInSection}` : '';
      if (key !== prevSectionKeyRef.current) {
        prevSectionKeyRef.current = key;
        setSectionInfo(s);
      }
    }
    rafRef.current = requestAnimationFrame(trackStep);
  }

  const handleToggle = async () => {
    if (playing) {
      engineRef.current?.stop();
      engineRef.current?.dispose();
      engineRef.current = null;
      cancelAnimationFrame(rafRef.current);
      prevChordRef.current = -1;
      prevSectionKeyRef.current = '';
      setSectionInfo(null);
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
      <div className="app-header">
        <h1 className="title">lofi.</h1>
        <Player playing={playing} onToggle={handleToggle} />
      </div>

      <div className="app-columns">
        <div className="left-panel">
          <LeftControls params={params} onChange={handleParamChange} />
        </div>

        <div className="middle-panel">
          <ProgressionPicker
            progressionId={params.progressionId}
            activeChordIndex={chordIndex}
            playing={playing}
            keyShift={params.keyShift}
            sectionInfo={sectionInfo}
            onChange={id => handleParamChange({ progressionId: id })}
          />
          <InstrumentToggles
            mix={params.mix}
            onChange={mix => handleParamChange({ mix })}
          />
        </div>

        <div className="right-panel">
          <RightControls params={params} onChange={handleParamChange} />
        </div>
      </div>
    </div>
  );
}
