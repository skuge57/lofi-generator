# lofi.

A browser-based lo-fi music generator. Procedurally synthesizes endless chill beats in real time using [Tone.js](https://tonejs.github.io/) — no samples, no loops, just oscillators, noise, and a few opinions about jazz harmony.

Built with React 19, TypeScript, and Vite.

## Features

- **8 chord progressions** — warm jazz voicings (maj7, m7, m9, 13) covering moods from "Sunday Morning" to "Late Night"
- **8 rhythmic moods** — `chill`, `sad`, `jazzy`, `dreamy`, `rainy`, `dusty`, `upbeat`, and `sleepy`, each with its own kick/snare/hihat pattern and chord placement
- **4 time signatures** — switch between `4/4`, `3/4`, `5/4`, and `6/8` with dedicated drum, chord, bass, and fill patterns
- **6 bass styles** — `simple` (root + fifth), `walking` (root → 3rd → 5th → approach), `lazy` (sustained root + syncopated fifth), plus `bounce`, `dub`, and `pedal` lines
- **Procedural melody** — short motifs that repeat for a few bars then mutate (inversion, contour jitter), with phrase endings snapped onto chord tones for tension/release
- **Counter-melody** — a soft second voice a third or sixth below the lead, hugging chord tones for harmony
- **Song form arrangement** — optional A/B/bridge structure that loops automatically: 4-bar intro (no drums) → A (8) → B (8, thinned drums) → A (8) → bridge (4, drums dropped) → A (8). Sections that drop drums end on a snare-roll fill that telegraphs the next section.
- **Energy curve** — a single energy control shapes the song form by section, morphing drum density, hi-hat activity, melody activity, and filter brightness over the arrangement
- **Per-instrument toggles** — mute chords, bass, kick, snare, hi-hat, melody, or vinyl crackle independently
- **Live mix controls** — BPM, key shift, octave shifts, chord length & timing jitter, drum hit probability, master volume, reverb, vinyl noise, tape wobble, bitcrush, low/high-pass filters
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
- The signal chain is: instruments → per-instrument gates → highpass → lowpass → tape wow/flutter → bitcrusher → limiter → master volume → output, with reverb fed in parallel as a send.
- The chord pad uses an FM synth into a tremolo for that wobbly Rhodes feel; the bass is a filtered MonoSynth; drums are synthesized (MembraneSynth kick, NoiseSynth snare, MetalSynth hat); vinyl texture layers filtered pink-noise dust with intermittent clicks, low pops, and brief dropouts

## Future plans

Rough roadmap, no promises:

### Sound design
- [ ] **Sample-based drums** — optional one-shot samples (kick, snare, hat) alongside the synthesized kit, for more authentic lo-fi grit
- [x] **Tape wow & flutter** — slow pitch modulation on the master bus to emulate worn cassette
- [ ] **Sidechain ducking** — gentle pump on chords/bass triggered by the kick
- [x] **Bitcrusher / sample-rate reduction** — optional lo-fi destruction on the master
- [x] **More instrument voices** — Wurlitzer, muted guitar, vibraphone alternatives for the chord pad
- [x] **Better vinyl** — intermittent clicks, pops, and dropouts layered with noise, not just steady filtered crackle

### Composition
- [ ] **User-defined progressions** — let users build chord sequences from a roman-numeral picker
- [x] **Song sections** — A / B / bridge structure with automatic arrangement (drops drums for 4 bars, brings them back with a snare-roll fill)
- [x] **Energy curve** — evolve the track over the form instead of static playback: intro sparse; verse / A normal; B with more hats and melody; bridge filtered; return with fuller drums. Driven by a single **energy** value (0–100) that morphs density, filter, and pattern weights by section
- [x] **Chord reharmonization** — optional flavor per progression: *diatonic*, *jazzy*, *darker*, *dreamy*, *spicy* — e.g. swap plain V for V13, tritone substitutions, or passing diminished chords while keeping the same Roman skeleton
- [x] **Voice-leading mode** — choose close inversions so pad voices move stepwise between changes instead of big jumps; warmer, more "played" pads
- [x] **Smarter melody** — motif development (repeat-and-vary) instead of fresh phrases each bar; tension/release shaping toward chord tones
- [x] **Counter-melody / second voice** — soft harmony line a third or sixth below the lead
- [x] **Swing / shuffle amount** — variable 16th-note swing slider
- [x] **Time signatures beyond 4/4** — 6/8, 3/4, 5/4 patterns

### UX
- [ ] **Seeded generation** — a **seed** field (or derived from URL) so the same settings always reproduce the same beat; handy for sharing, e.g. `/?seed=blue-cafe-4921&key=E&mood=sad`
- [ ] **Lock + randomize** — one action to randomize everything, with toggles to **lock** BPM, chords, drums, bass, melody, and tone / mix settings so only unlocked parts change
- [ ] **Preset save/load** — store full parameter sets in localStorage, share via URL (complements seeded generation for full state vs. stochastic DNA)
- [ ] **MIDI export** — render the current loop to a downloadable `.mid` file
- [ ] **WAV/MP3 capture** — record N bars to an audio file via `OfflineAudioContext`
- [ ] **Keyboard shortcuts** — space to play/pause, `[` `]` to shift key, etc.
- [ ] **Mobile layout** — controls don't fit cleanly on narrow screens yet
- [ ] **Visualizer upgrade** — animated waveform/spectrum, or a subtle scrolling piano roll

### Engineering
- [ ] **Tests for `musicTheory.ts`** — transpose, progression lookup, pattern shape
- [ ] **Web Worker scheduler** — investigate moving sequence logic off the main thread (Tone.js already handles this internally, but worth profiling under load)
- [ ] **Richer vinyl DSP** — custom noise / burst generator or worklet for deeper non-stationary crackle control
