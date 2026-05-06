import { DEFAULT_PARAMS } from './defaults';
import type { BassStyle, ChordVoice, EngineParams, Mood, ReharmFlavor, TimeSignature } from './engine/types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const TIME_SIG_ENCODE: Record<TimeSignature, string> = {
  '4/4': '44',
  '3/4': '34',
  '5/4': '54',
  '6/8': '68',
};
const TIME_SIG_DECODE: Record<string, TimeSignature> = {
  '44': '4/4',
  '34': '3/4',
  '54': '5/4',
  '68': '6/8',
};

const MOODS = new Set<Mood>(['chill', 'sad', 'jazzy', 'dreamy', 'rainy', 'dusty', 'upbeat', 'sleepy']);
const BASS = new Set<BassStyle>(['simple', 'walking', 'lazy', 'bounce', 'dub', 'pedal']);
const CHORD_VOICES = new Set<ChordVoice>([
  'rhodes',
  'wurlitzer',
  'muted-guitar',
  'vibraphone',
  'tape-choir',
  'juno-strings',
  'organ',
  'glass-pad',
]);
const REHARM_FLAVORS = new Set<ReharmFlavor>(['diatonic', 'jazzy', 'darker', 'dreamy', 'spicy']);
const INSTRUMENT_ORDER: (keyof EngineParams['mix'])[] = [
  'chord', 'bass', 'kick', 'snare', 'hihat', 'vinyl', 'melody', 'counter',
];

function encodeMix(mix: EngineParams['mix']): string {
  return INSTRUMENT_ORDER.map(k => (mix[k] ? '1' : '0')).join('');
}

function decodeMix(s: string): EngineParams['mix'] | null {
  if (!/^[01]{8}$/.test(s)) return null;
  const mix = { ...DEFAULT_PARAMS.mix };
  for (let i = 0; i < 8; i++) {
    mix[INSTRUMENT_ORDER[i]] = s[i] === '1';
  }
  return mix;
}

function encodeInstrumentVolume(volume: EngineParams['instrumentVolume']): string {
  return INSTRUMENT_ORDER.map(k => String(Number(volume[k].toFixed(2)))).join(',');
}

function decodeInstrumentVolume(s: string): EngineParams['instrumentVolume'] | null {
  const parts = s.split(',');
  if (parts.length !== INSTRUMENT_ORDER.length) return null;
  const volume = { ...DEFAULT_PARAMS.instrumentVolume };

  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n)) return null;
    volume[INSTRUMENT_ORDER[i]] = Math.max(0, Math.min(1.5, n));
  }

  return volume;
}

function parseNoteKey(raw: string): number | null {
  const t = raw.trim();
  const idx = NOTE_NAMES.findIndex(n => n.toLowerCase() === t.toLowerCase());
  return idx >= 0 ? idx : null;
}

export function parseParamsFromSearch(search: string): Partial<EngineParams> {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out: Partial<EngineParams> = {};

  const seed = q.get('seed') ?? q.get('s');
  if (seed !== null && seed !== '') out.seed = seed;

  const mood = q.get('mood') ?? q.get('m');
  if (mood && MOODS.has(mood as Mood)) out.mood = mood as Mood;

  const keyQ = q.get('key') ?? q.get('k');
  if (keyQ) {
    const ks = parseNoteKey(keyQ);
    if (ks !== null) out.keyShift = ks;
  }

  const prog = q.get('progression') ?? q.get('prog') ?? q.get('p');
  if (prog) out.progressionId = prog;

  const reharm = q.get('reharm') ?? q.get('rh');
  if (reharm && REHARM_FLAVORS.has(reharm as ReharmFlavor)) out.reharmFlavor = reharm as ReharmFlavor;

  const voice = q.get('voice') ?? q.get('cv');
  if (voice && CHORD_VOICES.has(voice as ChordVoice)) out.chordVoice = voice as ChordVoice;

  const vl = q.get('voiceLeading') ?? q.get('vl');
  if (vl === '1' || vl === 'true') out.voiceLeading = true;
  if (vl === '0' || vl === 'false') out.voiceLeading = false;

  const bpm = q.get('bpm') ?? q.get('b');
  if (bpm !== null && bpm !== '') {
    const n = Number(bpm);
    if (Number.isFinite(n)) out.bpm = Math.max(60, Math.min(110, Math.round(n)));
  }

  const ts = q.get('ts') ?? q.get('timeSignature');
  if (ts && TIME_SIG_DECODE[ts]) out.timeSignature = TIME_SIG_DECODE[ts];

  const bass = q.get('bass') ?? q.get('bs');
  if (bass && BASS.has(bass as BassStyle)) out.bassStyle = bass as BassStyle;

  const sf = q.get('songForm') ?? q.get('sf');
  if (sf === '1' || sf === 'true') out.songForm = true;
  if (sf === '0' || sf === 'false') out.songForm = false;

  const energy = q.get('energy') ?? q.get('en');
  if (energy !== null && energy !== '') {
    const n = Number(energy);
    if (Number.isFinite(n)) out.energy = Math.max(0, Math.min(100, Math.round(n)));
  }

  const oct = q.get('octaveShift') ?? q.get('oct');
  if (oct !== null && oct !== '') {
    const n = Number(oct);
    if (Number.isFinite(n)) out.octaveShift = Math.max(-2, Math.min(2, Math.round(n)));
  }

  const moct = q.get('melodyOctave') ?? q.get('moct');
  if (moct !== null && moct !== '') {
    const n = Number(moct);
    if (Number.isFinite(n)) out.melodyOctave = Math.max(-1, Math.min(1, Math.round(n)));
  }

  const clen = q.get('chordLength') ?? q.get('clen');
  if (clen !== null && clen !== '') {
    const n = Number(clen);
    if (Number.isFinite(n)) out.chordLength = Math.max(0.5, Math.min(4, n));
  }

  const ctime = q.get('chordTiming') ?? q.get('ctime');
  if (ctime !== null && ctime !== '') {
    const n = Number(ctime);
    if (Number.isFinite(n)) out.chordTiming = Math.max(0, Math.min(1, n));
  }

  const sidechain = q.get('sidechain') ?? q.get('sc');
  if (sidechain === '1' || sidechain === 'true') out.sidechainDucking = true;
  if (sidechain === '0' || sidechain === 'false') out.sidechainDucking = false;

  const swing = q.get('swing') ?? q.get('sw');
  if (swing !== null && swing !== '') {
    const n = Number(swing);
    if (Number.isFinite(n)) out.swing = Math.max(0, Math.min(1, n));
  }

  const dk = q.get('dk') ?? q.get('drumKick');
  const ds = q.get('ds') ?? q.get('drumSnare');
  const dh = q.get('dh') ?? q.get('drumHihat');
  if (dk !== null || ds !== null || dh !== null) {
    const drumProb = { ...DEFAULT_PARAMS.drumProb };
    if (dk !== null && dk !== '') {
      const n = Number(dk);
      if (Number.isFinite(n)) drumProb.kick = Math.max(0, Math.min(1, n));
    }
    if (ds !== null && ds !== '') {
      const n = Number(ds);
      if (Number.isFinite(n)) drumProb.snare = Math.max(0, Math.min(1, n));
    }
    if (dh !== null && dh !== '') {
      const n = Number(dh);
      if (Number.isFinite(n)) drumProb.hihat = Math.max(0, Math.min(1, n));
    }
    out.drumProb = drumProb;
  }

  const rev = q.get('reverb') ?? q.get('rev');
  if (rev !== null && rev !== '') {
    const n = Number(rev);
    if (Number.isFinite(n)) out.reverb = Math.max(0, Math.min(1, n));
  }
  const vol = q.get('volume') ?? q.get('vol');
  if (vol !== null && vol !== '') {
    const n = Number(vol);
    if (Number.isFinite(n)) out.masterVolume = Math.max(0, Math.min(2, n));
  }
  const vin = q.get('vinyl') ?? q.get('vin');
  if (vin !== null && vin !== '') {
    const n = Number(vin);
    if (Number.isFinite(n)) out.vinyl = Math.max(0, Math.min(1, n));
  }
  const tape = q.get('tape');
  if (tape !== null && tape !== '') {
    const n = Number(tape);
    if (Number.isFinite(n)) out.tape = Math.max(0, Math.min(1, n));
  }
  const crush = q.get('crush') ?? q.get('cr');
  if (crush !== null && crush !== '') {
    const n = Number(crush);
    if (Number.isFinite(n)) out.crush = Math.max(0, Math.min(1, n));
  }
  const lo = q.get('lowCut') ?? q.get('lo');
  if (lo !== null && lo !== '') {
    const n = Number(lo);
    if (Number.isFinite(n)) out.lowCut = Math.max(20, Math.min(500, n));
  }
  const hi = q.get('highCut') ?? q.get('hi');
  if (hi !== null && hi !== '') {
    const n = Number(hi);
    if (Number.isFinite(n)) out.highCut = Math.max(1000, Math.min(20000, n));
  }

  const mx = q.get('mix') ?? q.get('mx');
  if (mx) {
    const m = decodeMix(mx);
    if (m) out.mix = m;
  }

  const iv = q.get('instrumentVolume') ?? q.get('iv');
  if (iv) {
    const volume = decodeInstrumentVolume(iv);
    if (volume) out.instrumentVolume = volume;
  }

  return out;
}

function numEq(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

/** Human-readable query string (no leading ?). Omits values equal to defaults where possible. */
export function serializeParamsToSearch(params: EngineParams): string {
  const q = new URLSearchParams();
  const d = DEFAULT_PARAMS;

  if (params.seed?.trim()) q.set('seed', params.seed.trim());

  if (params.mood !== d.mood) q.set('mood', params.mood);
  if (params.keyShift !== d.keyShift) q.set('key', NOTE_NAMES[params.keyShift] ?? 'C');
  if (params.progressionId !== d.progressionId) q.set('progression', params.progressionId);
  if (params.reharmFlavor !== d.reharmFlavor) q.set('reharm', params.reharmFlavor);
  if (params.chordVoice !== d.chordVoice) q.set('voice', params.chordVoice);
  if (params.voiceLeading !== d.voiceLeading) q.set('vl', params.voiceLeading ? '1' : '0');
  if (params.bpm !== d.bpm) q.set('bpm', String(params.bpm));
  if (params.timeSignature !== d.timeSignature) q.set('ts', TIME_SIG_ENCODE[params.timeSignature]);
  if (params.bassStyle !== d.bassStyle) q.set('bass', params.bassStyle);
  if (params.songForm !== d.songForm) q.set('songForm', params.songForm ? '1' : '0');
  if (params.energy !== d.energy) q.set('energy', String(params.energy));
  if (params.octaveShift !== d.octaveShift) q.set('oct', String(params.octaveShift));
  if (params.melodyOctave !== d.melodyOctave) q.set('moct', String(params.melodyOctave));
  if (!numEq(params.chordLength, d.chordLength)) q.set('clen', String(params.chordLength));
  if (!numEq(params.chordTiming, d.chordTiming)) q.set('ctime', String(params.chordTiming));
  if (params.sidechainDucking !== d.sidechainDucking) q.set('sc', params.sidechainDucking ? '1' : '0');
  if (!numEq(params.swing, d.swing)) q.set('sw', String(params.swing));
  if (
    !numEq(params.drumProb.kick, d.drumProb.kick) ||
    !numEq(params.drumProb.snare, d.drumProb.snare) ||
    !numEq(params.drumProb.hihat, d.drumProb.hihat)
  ) {
    q.set('dk', String(params.drumProb.kick));
    q.set('ds', String(params.drumProb.snare));
    q.set('dh', String(params.drumProb.hihat));
  }
  if (!numEq(params.masterVolume, d.masterVolume)) q.set('vol', String(params.masterVolume));
  if (!numEq(params.reverb, d.reverb)) q.set('rev', String(params.reverb));
  if (!numEq(params.vinyl, d.vinyl)) q.set('vin', String(params.vinyl));
  if (!numEq(params.tape, d.tape)) q.set('tape', String(params.tape));
  if (!numEq(params.crush, d.crush)) q.set('crush', String(params.crush));
  if (params.lowCut !== d.lowCut) q.set('lo', String(Math.round(params.lowCut)));
  if (params.highCut !== d.highCut) q.set('hi', String(Math.round(params.highCut)));

  const mixEnc = encodeMix(params.mix);
  const defMix = encodeMix(d.mix);
  if (mixEnc !== defMix) q.set('mix', mixEnc);

  const instVolEnc = encodeInstrumentVolume(params.instrumentVolume);
  const defInstVolEnc = encodeInstrumentVolume(d.instrumentVolume);
  if (instVolEnc !== defInstVolEnc) q.set('iv', instVolEnc);

  const s = q.toString();
  return s;
}
