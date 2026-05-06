# lofi.

A browser-based lo-fi music generator. Procedurally synthesizes endless chill beats in real time using [Tone.js](https://tonejs.github.io/) — mostly oscillators and noise, with an optional sampled guitar voice and a few opinions about jazz harmony.

Built with React 19, TypeScript, and Vite.

## Features

- **8 chord progressions** — warm jazz voicings (maj7, m7, m9, 13) covering moods from "Sunday Morning" to "Late Night"
- **8 rhythmic moods** — `chill`, `sad`, `jazzy`, `dreamy`, `rainy`, `dusty`, `upbeat`, and `sleepy`, each with its own kick/snare/hihat pattern and chord placement
- **4 time signatures** — switch between `4/4`, `3/4`, `5/4`, and `6/8` with dedicated drum, chord, bass, and fill patterns
- **6 bass styles** — `simple` (root + fifth), `walking` (root → 3rd → 5th → approach), `lazy` (sustained root + syncopated fifth), plus `bounce`, `dub`, and `pedal` lines
- **Procedural melody** — progression-level call/answer themes that repeat across chord cycles before mutating, with phrase endings snapped onto chord tones for tension/release
- **Counter-melody** — a soft second voice that harmonizes key lead notes and replies in nearby rests, staying a third or sixth below on chord tones
- **Song form arrangement** — optional A/B/bridge structure that loops automatically: 4-bar intro (no drums) → A (8) → B (8, thinned drums) → A (8) → bridge (4, kick/snare dropped) → A (8). Transition sections end on a snare-roll fill that telegraphs the next section.
- **Energy curve** — a single energy control shapes the song form by section, morphing drum density, hi-hat activity, melody activity, and filter brightness over the arrangement
- **Per-instrument mix controls** — mute chords, bass, kick, snare, hi-hat, melody, counter-melody, or vinyl crackle independently, then trim each instrument from 0–150%
- **Live mix controls** — BPM, key shift, octave shifts, chord length & timing jitter, sidechain ducking, drum hit probability, per-instrument volume, master volume, reverb, vinyl noise, tape wobble, bitcrush, low/high-pass filters
- **Seeded sharing** — a seed field plus URL-serialized settings make beats reproducible and easy to share
- **Lockable randomize** — generate a fresh parameter set from the header button while locking BPM, chords, drums, bass, melody, or tone / mix groups you want to keep
- **Visual feedback** — current chord highlighted while the progression plays
- **Cached scheduler data** — harmonic/rhythm data is pre-cached, and the melody/counter buffers are reused per bar so the 16th-note scheduler stays light

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

## License

Code is licensed under the MIT License. The bundled guitar samples in `public/samples/guitar` are from [`cluesurf/wave`](https://github.com/cluesurf/wave) and are stated upstream as public domain; see `public/samples/guitar/README.md` for the local source note.

## Other scripts

```bash
npm run build     # type-check + production build
npm run preview   # serve the production build locally
npm run lint      # eslint
```

## How it works

The audio engine (`src/engine/lofiEngine.ts`) drives a `Tone.Sequence` at 16th notes. On each step it consults pre-built caches for the current chord, bass note, and drum pattern. Melody and counter-melody buffers are generated once per bar and reused across that bar. When you change a parameter, the relevant cache is rebuilt outside the scheduled note callback where possible.

- Chord progressions and rhythm patterns live in `src/engine/musicTheory.ts`
- The signal chain is: instruments → per-instrument gates → highpass → lowpass → tape wow/flutter → bitcrusher → limiter → master volume → output, with reverb fed in parallel as a send.
- The chord pad can switch between Rhodes/Wurli-style keys, sampled muted guitar, vibes, tape choir, synth strings, organ, and glassy FM tones; the bass is a filtered MonoSynth; drums are synthesized (MembraneSynth kick, NoiseSynth snare, filtered NoiseSynth hat); vinyl texture layers filtered pink-noise dust with intermittent clicks, low pops, and brief dropouts
- `src/urlState.ts` serializes most controls into the URL, including seed, mood, key, progression, reharmonization, voice, time signature, bass style, arrangement, mutes, per-instrument volumes, and tone settings

## Future plans

Rough roadmap, no promises:

### Sound design
- [ ] **Sample-based drums** — optional one-shot samples (kick, snare, hat) alongside the synthesized kit, for more authentic lo-fi grit
- [ ] **Drum kit selector** — switch between synthesized drums and sample-based kits such as dusty vinyl, soft jazz, cassette, bitcrushed, and minimal click kits while keeping the same procedural groove engine
- [ ] **Guitar articulation layer** — sampled guitar can add slides, grace notes, pick variation, muted plucks, soft string noise, and octave doubling for more organic phrases
- [ ] **Cassette deck models** — choose tape flavors such as clean cassette, worn cassette, broken walkman, VHS, old radio, underwater, or phone speaker; each maps to wow/flutter, filtering, saturation, and noise
- [ ] **Saturation / drive stage** — add tape warmth, soft clipping, speaker dirt, and optional per-instrument drive before the master limiter
- [ ] **Vinyl scene presets** — layer procedural ambience such as dusty record, rainy window, cafe room, train ambience, distant street, fireplace, or late-night room tone
- [ ] **Stereo width controls** — widen pads and texture while keeping kick, snare, and bass mono-safe, with a master mono-check button
- [x] **Auto-mix** — rebalance instrument levels and prevent clipping after randomizing aggressive settings
- [x] **Tape wow & flutter** — slow pitch modulation on the master bus to emulate worn cassette
- [x] **Sidechain ducking** — gentle pump on chords/bass triggered by the kick
- [x] **Bitcrusher / sample-rate reduction** — optional lo-fi destruction on the master
- [x] **More instrument voices** — Wurlitzer, muted guitar, vibraphone, tape choir, Juno strings, organ, and glass pad alternatives for the chord pad
- [x] **Better vinyl** — intermittent clicks, pops, and dropouts layered with noise, not just steady filtered crackle

### Composition
- [ ] **User-defined progressions** — let users build chord sequences from a roman-numeral picker
- [ ] **Human feel macro** — one control adds timing drift, velocity variation, chord strum spread, bass looseness, ghost notes, and occasional lazy hits
- [ ] **Section-aware pattern variation** — drum, bass, chord, and melody patterns subtly mutate between A, B, and bridge sections so the form feels more arranged
- [ ] **Melody personalities** — choose between sparse, jazzy, pentatonic, guitar-like, vocal, or arpeggiated lead behavior
- [ ] **Chord substitution intensity** — scale reharmonization from plain diatonic changes through extensions, secondary dominants, tritone substitutions, and altered chords
- [ ] **Bass player personalities** — bass behavior can lean upright, synth sub, dubby, lazy guitarist, walking jazz, off-grid, or root-only minimalist
- [x] **Song sections** — A / B / bridge structure with automatic arrangement (drops drums for 4 bars, brings them back with a snare-roll fill)
- [x] **Energy curve** — evolve the track over the form instead of static playback: intro sparse; verse / A normal; B with more hats and melody; bridge filtered; return with fuller drums. Driven by a single **energy** value (0–100) that morphs density, filter, and pattern weights by section
- [x] **Chord reharmonization** — optional flavor per progression: *diatonic*, *jazzy*, *darker*, *dreamy*, *spicy* — e.g. swap plain V for V13, tritone substitutions, or passing diminished chords while keeping the same Roman skeleton
- [x] **Voice-leading mode** — choose close inversions so pad voices move stepwise between changes instead of big jumps; warmer, more "played" pads
- [x] **Smarter melody** — motif development (repeat-and-vary) instead of fresh phrases each bar; tension/release shaping toward chord tones
- [x] **Counter-melody / second voice** — soft harmony and answer line a third or sixth below the lead
- [x] **Swing / shuffle amount** — variable 16th-note swing slider
- [x] **Time signatures beyond 4/4** — 6/8, 3/4, 5/4 patterns

### UX
- [ ] **Simple / advanced mode** — expose play, randomize, mood, energy, key, and volume in simple mode while keeping deeper controls available in advanced mode
- [ ] **Macro controls** — high-level knobs like warmth, dust, space, movement, complexity, darkness, and human feel control multiple underlying audio parameters
- [ ] **Beat history** — keep recent randomized beats in a history stack with previous, favorite, copy URL, and restore actions
- [ ] **Arrangement timeline** — show the current song section and bar position across intro, A, B, bridge, and return sections
- [ ] **Text-to-vibe mapping** — convert short prompts like "sleepy rainy jazz cafe" into mood, BPM, progression, instrument, filter, and texture settings
- [ ] **Study timer mode** — add focus/break timers with gentle musical transitions instead of harsh alarms
- [ ] **Live performance controls** — trigger fills, drop drums, mute instruments, sweep filters, increase energy, or randomize selected parts during playback
- [x] **Seeded generation + URL sharing** — a **seed** field and serialized URL settings reproduce/share the same beat, e.g. `/?seed=blue-cafe-4921&key=E&mood=sad`
- [x] **Randomize** — one action generates a fresh full parameter set and seed
- [x] **Per-instrument levels** — individual volume sliders for chords, bass, kick, snare, hi-hat, melody, counter-melody, and vinyl
- [x] **Lockable randomize** — toggles to **lock** BPM, chords, drums, bass, melody, and tone / mix settings so only unlocked parts change
- [ ] **Preset save/load** — store named full parameter sets in localStorage
- [ ] **MIDI export** — render the current loop to a downloadable `.mid` file
- [ ] **WAV/MP3 capture** — record N bars to an audio file via `OfflineAudioContext`
- [x] **Basic keyboard shortcuts** — space to play/pause, ArrowUp/ArrowDown to adjust master volume
- [x] **Responsive layout** — controls collapse from three columns to two and then one column on narrower screens
- [ ] **More keyboard shortcuts** — `[` `]` to shift key, quick randomize, and focused transport/mix controls
- [ ] **Visualizer upgrade** — animated waveform/spectrum, or a subtle scrolling piano roll

### Export / presets
- [ ] **Project file import/export** — save and load full beat settings as a portable `.lofi.json` file in addition to URL sharing
- [ ] **Stem export** — render chords, bass, drums, melody, vinyl, and full mix as separate audio files
- [ ] **Render-safe mode** — temporarily freeze live UI changes during offline export so rendered audio stays deterministic and glitch-free

### Engineering
- [ ] **Tests for `musicTheory.ts`** — transpose, progression lookup, pattern shape
- [ ] **Seed snapshot tests** — verify that the same seed and settings always produce the same progression, bass, melody, counter-melody, and serialized URL state
- [ ] **Audio load meter** — hidden debug panel showing scheduler timing, active voices, cache rebuilds, and late events
- [ ] **Engine API separation** — expose the lo-fi engine independently from React so playback, MIDI export, WAV rendering, and tests can share the same core logic
- [ ] **Web Worker scheduler** — investigate moving sequence logic off the main thread (Tone.js already handles this internally, but worth profiling under load)
- [ ] **Richer vinyl DSP** — custom noise / burst generator or worklet for deeper non-stationary crackle control
