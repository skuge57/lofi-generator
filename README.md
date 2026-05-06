# lofi.

A browser-based lo-fi music generator. Procedurally synthesizes endless chill beats in real time using [Tone.js](https://tonejs.github.io/) — no samples, no loops, just oscillators, noise, and a few opinions about jazz harmony.

Built with React 19, TypeScript, and Vite.

## Features

- **8 chord progressions** — warm jazz voicings (maj7, m7, m9, 13) covering moods from "Sunday Morning" to "Late Night"
- **3 rhythmic moods** — `chill`, `sad`, `jazzy`, each with its own kick/snare/hihat pattern and chord placement
- **3 bass styles** — `simple` (root + fifth), `walking` (root → 3rd → 5th → approach), `lazy` (sustained root + syncopated fifth)
- **Procedural melody** — directional phrases (1–2 per bar) that move stepwise through the scale, with phrase-ending resolution notes and continuity across bars
- **Song form arrangement** — optional A/B/bridge structure that loops automatically: 4-bar intro (no drums) → A (8) → B (8, thinned drums) → A (8) → bridge (4, drums dropped) → A (8). Sections that drop drums end on a snare-roll fill that telegraphs the next section.
- **Per-instrument toggles** — mute chords, bass, kick, snare, hi-hat, melody, or vinyl crackle independently
- **Live mix controls** — BPM, key shift, octave shifts, chord length & timing jitter, drum hit probability, reverb, vinyl noise, low/high-pass filters
- **Visual feedback** — current chord highlighted while the progression plays
- **Zero allocations in the audio tick** — all note data is pre-cached and rebuilt only when params change, so the 16th-note scheduler stays GC-free

## Stack

- React 19 + TypeScript
- Tone.js 15 (Web Audio synthesis & scheduling)
- Vite 8

## Running locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`) and click play. Audio won't start until you interact with the page — that's a browser autoplay policy, not a bug.

### Other scripts

```bash
npm run build     # type-check + production build
npm run preview   # serve the production build locally
npm run lint      # eslint
```

## How it works

The audio engine (`src/engine/lofiEngine.ts`) drives a `Tone.Sequence` at 16th notes. On every tick it consults pre-built caches for the current chord, bass note, drum pattern, and melody buffer. When you change a parameter, the relevant cache is rebuilt off the audio thread.

- Chord progressions and rhythm patterns live in `src/engine/musicTheory.ts`
- The signal chain is: instruments → per-instrument gates → highpass → lowpass → reverb → limiter → output
- The chord pad uses an FM synth into a tremolo for that wobbly Rhodes feel; the bass is a filtered MonoSynth; drums are synthesized (MembraneSynth kick, NoiseSynth snare, MetalSynth hat); vinyl crackle is filtered pink noise

## Future plans

Rough roadmap, no promises:

### Sound design
- [ ] **Sample-based drums** — optional one-shot samples (kick, snare, hat) alongside the synthesized kit, for more authentic lo-fi grit
- [ ] **Tape wow & flutter** — slow pitch modulation on the master bus to emulate worn cassette
- [ ] **Sidechain ducking** — gentle pump on chords/bass triggered by the kick
- [ ] **Bitcrusher / sample-rate reduction** — optional lo-fi destruction on the master
- [ ] **More instrument voices** — Wurlitzer, muted guitar, vibraphone alternatives for the chord pad

### Composition
- [ ] **User-defined progressions** — let users build chord sequences from a roman-numeral picker
- [x] **Song sections** — A / B / bridge structure with automatic arrangement (drops drums for 4 bars, brings them back with a snare-roll fill)
- [ ] **Smarter melody** — motif development (repeat-and-vary) instead of fresh phrases each bar; tension/release shaping toward chord tones
- [ ] **Counter-melody / second voice** — soft harmony line a third or sixth below the lead
- [ ] **Swing / shuffle amount** — variable 16th-note swing slider
- [ ] **Time signatures beyond 4/4** — 6/8, 3/4, 5/4 patterns

### UX
- [ ] **Preset save/load** — store full parameter sets in localStorage, share via URL
- [ ] **MIDI export** — render the current loop to a downloadable `.mid` file
- [ ] **WAV/MP3 capture** — record N bars to an audio file via `OfflineAudioContext`
- [ ] **Keyboard shortcuts** — space to play/pause, `[` `]` to shift key, etc.
- [ ] **Mobile layout** — controls don't fit cleanly on narrow screens yet
- [ ] **Visualizer upgrade** — animated waveform/spectrum, or a subtle scrolling piano roll

### Engineering
- [ ] **Tests for `musicTheory.ts`** — transpose, progression lookup, pattern shape
- [ ] **Web Worker scheduler** — investigate moving sequence logic off the main thread (Tone.js already handles this internally, but worth profiling under load)
- [ ] **Audio worklet for vinyl** — replace `Tone.Noise` + filter with a custom worklet for crackle that sounds more like dust than pink noise
