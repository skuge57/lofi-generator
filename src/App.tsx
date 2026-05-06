import { useState, useRef, useCallback, useEffect } from 'react';
import { LofiEngine } from './engine/lofiEngine';
import { Player } from './components/Player';
import { LeftControls, RhythmControls, RightControls } from './components/Controls';
import { InstrumentToggles } from './components/InstrumentToggles';
import { ProgressionPicker } from './components/ProgressionPicker';
import { PROGRESSIONS } from './engine/musicTheory';
import type { BassStyle, ChordVoice, EngineParams, Mood, ReharmFlavor, SectionInfo, TimeSignature } from './engine/types';
import { DEFAULT_PARAMS } from './defaults';
import { parseParamsFromSearch, serializeParamsToSearch } from './urlState';
import './App.css';

const MASTER_VOLUME_MIN = 0;
const MASTER_VOLUME_MAX = 2;
const MASTER_VOLUME_KEY_STEP = 0.05;
const MOODS: Mood[] = ['chill', 'sad', 'jazzy', 'dreamy', 'rainy', 'dusty', 'upbeat', 'sleepy'];
const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '5/4', '6/8'];
const BASS_STYLES: BassStyle[] = ['simple', 'walking', 'lazy', 'bounce', 'dub', 'pedal'];
const CHORD_VOICES: ChordVoice[] = [
  'rhodes',
  'wurlitzer',
  'muted-guitar',
  'vibraphone',
  'tape-choir',
  'juno-strings',
  'organ',
  'glass-pad',
];
const REHARM_FLAVORS: ReharmFlavor[] = ['diatonic', 'jazzy', 'darker', 'dreamy', 'spicy'];
const INSTRUMENT_KEYS: (keyof EngineParams['mix'])[] = [
  'chord',
  'bass',
  'kick',
  'snare',
  'hihat',
  'vinyl',
  'melody',
  'counter',
];

type RandomizeLockKey = 'bpm' | 'chords' | 'drums' | 'bass' | 'melody' | 'toneMix';
type RandomizeLocks = Record<RandomizeLockKey, boolean>;

const RANDOMIZE_LOCKS: { key: RandomizeLockKey; label: string }[] = [
  { key: 'bpm', label: 'BPM' },
  { key: 'chords', label: 'Chords' },
  { key: 'drums', label: 'Drums' },
  { key: 'bass', label: 'Bass' },
  { key: 'melody', label: 'Melody' },
  { key: 'toneMix', label: 'Tone / mix' },
];

const DEFAULT_RANDOMIZE_LOCKS: RandomizeLocks = {
  bpm: false,
  chords: false,
  drums: false,
  bass: false,
  melody: false,
  toneMix: false,
};

function choice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomStepped(min: number, max: number, step: number): number {
  const steps = Math.round((max - min) / step);
  return Number((min + randomInt(0, steps) * step).toFixed(2));
}

function randomSeed(): string {
  return `lofi-${Math.random().toString(36).slice(2, 8)}`;
}

function randomizeMix(): EngineParams['mix'] {
  const mix: EngineParams['mix'] = {
    chord: Math.random() < 0.88,
    bass: Math.random() < 0.88,
    kick: Math.random() < 0.92,
    snare: Math.random() < 0.88,
    hihat: Math.random() < 0.86,
    vinyl: Math.random() < 0.78,
    melody: Math.random() < 0.82,
    counter: Math.random() < 0.66,
  };

  if (!mix.chord && !mix.bass && !mix.melody && !mix.counter) {
    mix[choice(['chord', 'bass', 'melody'] as const)] = true;
  }
  if (!mix.kick && !mix.snare && !mix.hihat) {
    mix.kick = true;
    mix.snare = true;
  }

  return mix;
}

function randomizeInstrumentVolume(): EngineParams['instrumentVolume'] {
  return INSTRUMENT_KEYS.reduce((volume, key) => {
    volume[key] = key === 'vinyl'
      ? randomStepped(0.35, 1, 0.05)
      : randomStepped(0.65, 1.25, 0.05);
    return volume;
  }, {} as EngineParams['instrumentVolume']);
}

function autoMixVolumes(params: EngineParams): EngineParams['instrumentVolume'] {
  const { mix, instrumentVolume, reverb, tape, crush } = params;
  // High effects density builds up perceived loudness — compensate with lower fader levels
  const effectsLoad =
    Math.max(0, reverb - 0.5) * 0.5 +
    Math.max(0, tape - 0.4) * 0.4 +
    crush * 0.6;
  // Stacking many harmonic layers crowds the mix
  const activeHarmonic = (['chord', 'bass', 'melody', 'counter'] as const).filter(k => mix[k]).length;
  const harmonicLoad = Math.max(0, activeHarmonic - 2) * 0.07;
  const scale = 1 - Math.min(effectsLoad + harmonicLoad, 0.3);
  return INSTRUMENT_KEYS.reduce((vol, key) => {
    vol[key] = Number(Math.min(1.5, Math.max(0, instrumentVolume[key] * scale)).toFixed(2));
    return vol;
  }, {} as EngineParams['instrumentVolume']);
}

function randomizeParams(current: EngineParams, locks: RandomizeLocks): EngineParams {
  const next: EngineParams = {
    ...current,
    seed: locks.melody ? current.seed : randomSeed(),
    bpm: randomInt(68, 104),
    mood: choice(MOODS),
    progressionId: choice(PROGRESSIONS).id,
    reharmFlavor: choice(REHARM_FLAVORS),
    chordVoice: choice(CHORD_VOICES),
    voiceLeading: Math.random() < 0.55,
    reverb: randomStepped(0.25, 0.85, 0.05),
    vinyl: randomStepped(0.15, 0.7, 0.05),
    tape: randomStepped(0.1, 0.75, 0.05),
    crush: randomStepped(0, 0.35, 0.05),
    lowCut: randomInt(35, 180),
    highCut: randomInt(3500, 14000),
    octaveShift: randomInt(-1, 1),
    melodyOctave: randomInt(-1, 1),
    chordLength: randomStepped(0.6, 2.8, 0.1),
    chordTiming: randomStepped(0.05, 0.65, 0.05),
    swing: randomStepped(0, 0.45, 0.05),
    drumProb: {
      kick: randomStepped(0.7, 1, 0.05),
      snare: randomStepped(0.65, 1, 0.05),
      hihat: randomStepped(0.45, 1, 0.05),
    },
    keyShift: randomInt(0, 11),
    bassStyle: choice(BASS_STYLES),
    energy: randomInt(35, 95),
    timeSignature: choice(TIME_SIGNATURES),
    mix: randomizeMix(),
    instrumentVolume: randomizeInstrumentVolume(),
  };

  if (locks.bpm) {
    next.bpm = current.bpm;
  }

  if (locks.chords) {
    next.keyShift = current.keyShift;
    next.progressionId = current.progressionId;
    next.reharmFlavor = current.reharmFlavor;
    next.chordVoice = current.chordVoice;
    next.voiceLeading = current.voiceLeading;
    next.octaveShift = current.octaveShift;
    next.chordLength = current.chordLength;
    next.chordTiming = current.chordTiming;
  }

  if (locks.drums) {
    next.mood = current.mood;
    next.timeSignature = current.timeSignature;
    next.swing = current.swing;
    next.energy = current.energy;
    next.drumProb = { ...current.drumProb };
  }

  if (locks.bass) {
    next.bassStyle = current.bassStyle;
  }

  if (locks.melody) {
    next.seed = current.seed;
    next.melodyOctave = current.melodyOctave;
  }

  if (locks.toneMix) {
    next.reverb = current.reverb;
    next.vinyl = current.vinyl;
    next.tape = current.tape;
    next.crush = current.crush;
    next.lowCut = current.lowCut;
    next.highCut = current.highCut;
    next.mix = { ...current.mix };
    next.instrumentVolume = { ...current.instrumentVolume };
  } else {
    next.instrumentVolume = autoMixVolumes(next);
  }

  return next;
}

function clampMasterVolume(value: number) {
  return Math.min(MASTER_VOLUME_MAX, Math.max(MASTER_VOLUME_MIN, Number(value.toFixed(2))));
}

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

export default function App() {
  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<EngineParams>(() => ({
    ...DEFAULT_PARAMS,
    ...parseParamsFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
  }));
  const [chordIndex, setChordIndex] = useState(0);
  const [sectionInfo, setSectionInfo] = useState<SectionInfo | null>(null);
  const [randomizeLocks, setRandomizeLocks] = useState<RandomizeLocks>(DEFAULT_RANDOMIZE_LOCKS);
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

  const handleRandomize = useCallback(() => {
    setParams(prev => {
      const next = randomizeParams(prev, randomizeLocks);
      engineRef.current?.updateParams(next);
      return next;
    });
  }, [randomizeLocks]);

  const handleRandomizeLockToggle = useCallback((key: RandomizeLockKey) => {
    setRandomizeLocks(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTextInputTarget(event.target)) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        void handleToggle();
        return;
      }

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        const direction = event.code === 'ArrowUp' ? 1 : -1;
        handleParamChange({
          masterVolume: clampMasterVolume(params.masterVolume + direction * MASTER_VOLUME_KEY_STEP),
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
        <div className="header-actions">
          <div className="randomize-cluster">
            <button type="button" className="randomize-btn" onClick={handleRandomize}>
              Randomize
            </button>
            <div className="randomize-locks" aria-label="Randomize locks">
              <span className="randomize-locks-label">Locks</span>
              {RANDOMIZE_LOCKS.map(lock => (
                <button
                  key={lock.key}
                  type="button"
                  className={`randomize-lock ${randomizeLocks[lock.key] ? 'locked' : ''}`}
                  aria-pressed={randomizeLocks[lock.key]}
                  aria-label={`${randomizeLocks[lock.key] ? 'Unlock' : 'Lock'} ${lock.label} during randomize`}
                  onClick={() => handleRandomizeLockToggle(lock.key)}
                >
                  {lock.label}
                </button>
              ))}
            </div>
          </div>
          <Player playing={playing} onToggle={handleToggle} />
        </div>
      </div>

      <div className="app-columns">
        <div className="left-panel">
          <LeftControls params={params} onChange={handleParamChange} />
        </div>

        <div className="middle-panel">
          <ProgressionPicker
            progressionId={params.progressionId}
            reharmFlavor={params.reharmFlavor}
            activeChordIndex={chordIndex}
            playing={playing}
            songForm={params.songForm}
            keyShift={params.keyShift}
            sectionInfo={sectionInfo}
            onChange={id => handleParamChange({ progressionId: id })}
            onReharmFlavorChange={reharmFlavor => handleParamChange({ reharmFlavor })}
          />
          <InstrumentToggles
            mix={params.mix}
            volume={params.instrumentVolume}
            onMixChange={mix => handleParamChange({ mix })}
            onVolumeChange={instrumentVolume => handleParamChange({ instrumentVolume })}
          />
          <RhythmControls params={params} onChange={handleParamChange} />
        </div>

        <div className="right-panel">
          <RightControls params={params} onChange={handleParamChange} />
        </div>
      </div>
    </div>
  );
}
