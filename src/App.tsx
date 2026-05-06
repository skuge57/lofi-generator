import { useState, useRef, useCallback, useEffect } from 'react';
import { LofiEngine } from './engine/lofiEngine';
import { Player } from './components/Player';
import { LeftControls, RightControls } from './components/Controls';
import { InstrumentToggles } from './components/InstrumentToggles';
import { ProgressionPicker } from './components/ProgressionPicker';
import type { EngineParams, SectionInfo } from './engine/types';
import { DEFAULT_PARAMS } from './defaults';
import { parseParamsFromSearch, serializeParamsToSearch } from './urlState';
import './App.css';

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<EngineParams>(() => ({
    ...DEFAULT_PARAMS,
    ...parseParamsFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
  }));
  const [chordIndex, setChordIndex] = useState(0);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const engineRef = useRef<LofiEngine | null>(null);
  const rafRef = useRef<number>(0);
  const prevChordRef = useRef(-1);
  const prevSectionKeyRef = useRef('');
  const urlHydratedRef = useRef(false);

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
      if ('seed' in update && (update.seed === undefined || update.seed === '')) {
        delete next.seed;
      }
      const forEngine =
        'seed' in update
          ? {
              ...update,
              seed: update.seed === undefined || update.seed === '' ? undefined : update.seed,
            }
          : update;
      engineRef.current?.updateParams(forEngine);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!urlHydratedRef.current) {
      urlHydratedRef.current = true;
      return;
    }
    const qs = serializeParamsToSearch(params);
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [params]);

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

