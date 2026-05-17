import { useEffect, useRef, type RefObject } from 'react';
import * as Tone from 'tone';
import type { LofiEngine, VisualLane } from '../engine/lofiEngine';

const FRAME_MS = 1000 / 30;
const REDUCED_MOTION_FRAME_MS = 1000 / 12;
const HISTORY_SECONDS = 4.2;
const FUTURE_SECONDS = 0.9;
const MIN_DPR = 1;
const MAX_DPR = 2;

const LANES: VisualLane[] = ['melody', 'counter', 'chord', 'bass', 'hihat', 'snare', 'kick'];
const LANE_LABELS: Record<VisualLane, string> = {
  melody: 'mel',
  counter: 'ctr',
  chord: 'chd',
  bass: 'bas',
  hihat: 'hat',
  snare: 'snr',
  kick: 'kik',
};
const LANE_INDEX = LANES.reduce((map, lane, index) => {
  map[lane] = index;
  return map;
}, {} as Record<VisualLane, number>);
const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};
const COLORS: Record<VisualLane, string> = {
  melody: '#e7c884',
  counter: '#8ac4b8',
  chord: '#b68df0',
  bass: '#da826d',
  hihat: '#b9c2cb',
  snare: '#e0a05f',
  kick: '#c76b5b',
};

interface RenderEvent {
  id: number;
  lane: VisualLane;
  time: number;
  step: number;
  velocity: number;
  note: string;
  durationSteps: number;
  durationSeconds: number;
  midi: number | null;
}

interface VisualizerProps {
  engineRef: RefObject<LofiEngine | null>;
  playing: boolean;
}

function noteToMidi(note: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!match) return null;

  const pitch = `${match[1]}${match[2]}`;
  const offset = NOTE_OFFSETS[pitch];
  const octave = Number(match[3]);
  if (offset === undefined || !Number.isFinite(octave)) return null;

  return (octave + 1) * 12 + offset;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function eventY(event: RenderEvent, laneTop: number, laneHeight: number): number {
  if (event.midi === null || event.lane === 'kick' || event.lane === 'snare' || event.lane === 'hihat') {
    return laneTop + laneHeight * 0.5;
  }

  const min = event.lane === 'bass' ? 30 : 48;
  const max = event.lane === 'bass' ? 58 : 84;
  const pitch = clamp((event.midi - min) / (max - min), 0, 1);
  return laneTop + laneHeight * (0.82 - pitch * 0.64);
}

function resizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = clamp(window.devicePixelRatio || 1, MIN_DPR, MAX_DPR);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function consumeEvents(
  engine: LofiEngine,
  lastCursor: number,
  renderEvents: RenderEvent[]
): number {
  const cursor = engine.getVisualCursor();
  const capacity = engine.getVisualCapacity();
  const start = Math.max(lastCursor, cursor - capacity);
  const source = engine.getVisualEvents();

  for (let id = start; id < cursor; id++) {
    const event = source[id % capacity];
    if (event.id !== id) continue;
    renderEvents.push({
      id,
      lane: event.lane,
      time: event.time,
      step: event.step,
      velocity: event.velocity,
      note: event.note,
      durationSteps: event.durationSteps,
      durationSeconds: event.durationSeconds,
      midi: noteToMidi(event.note),
    });
  }

  return cursor;
}

function pruneEvents(events: RenderEvent[], now: number): void {
  let write = 0;
  for (let read = 0; read < events.length; read++) {
    const event = events[read];
    const age = now - event.time;
    if (age > HISTORY_SECONDS || age < -FUTURE_SECONDS) continue;
    events[write] = event;
    write++;
  }
  events.length = write;
}

function drawVisualizer(
  canvas: HTMLCanvasElement,
  engine: LofiEngine | null,
  playing: boolean,
  events: RenderEvent[]
): void {
  const ctx = resizeCanvas(canvas);
  if (!ctx) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const laneHeight = height / LANES.length;
  const now = playing && engine ? Tone.now() : 0;
  const timelineSeconds = HISTORY_SECONDS + FUTURE_SECONDS;
  const pxPerSecond = width / timelineSeconds;
  const playheadX = width * (HISTORY_SECONDS / timelineSeconds);
  const secondsPerStep = 60 / Math.max(1, Tone.getTransport().bpm.value) / 4;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#181511');
  bg.addColorStop(0.58, '#1e1915');
  bg.addColorStop(1, '#161818');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.88;
  for (let i = 0; i < LANES.length; i++) {
    const y = i * laneHeight;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.055)';
    ctx.fillRect(0, y, width, laneHeight);
    ctx.strokeStyle = 'rgba(200, 168, 122, 0.105)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(138, 112, 96, 0.55)';
    ctx.font = '10px Georgia, serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(LANE_LABELS[LANES[i]], 9, y + laneHeight * 0.5);
  }
  ctx.restore();

  if (playing && engine) {
    const phase = now % secondsPerStep;
    let tick = -phase;
    let index = 0;
    while (tick > -HISTORY_SECONDS) {
      const x = playheadX + tick * pxPerSecond;
      ctx.strokeStyle = index % 4 === 0 ? 'rgba(200, 168, 122, 0.13)' : 'rgba(200, 168, 122, 0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
      tick -= secondsPerStep;
      index++;
    }

    tick = secondsPerStep - phase;
    index = 1;
    while (tick < FUTURE_SECONDS) {
      const x = playheadX + tick * pxPerSecond;
      ctx.strokeStyle = index % 4 === 0 ? 'rgba(200, 168, 122, 0.13)' : 'rgba(200, 168, 122, 0.055)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
      tick += secondsPerStep;
      index++;
    }
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const lane = LANE_INDEX[event.lane];
    const laneTop = lane * laneHeight;
    const age = now - event.time;
    const x = playheadX - age * pxPerSecond;
    if (x < -70 || x > width + 70) continue;

    const velocity = clamp(event.velocity, 0.15, 1);
    const color = COLORS[event.lane];
    const y = eventY(event, laneTop, laneHeight);
    const isDrum = event.lane === 'kick' || event.lane === 'snare' || event.lane === 'hihat';
    const eventWidth = isDrum
      ? 4 + velocity * 12
      : clamp(event.durationSeconds * pxPerSecond, 12, event.lane === 'chord' ? 150 : 70);
    const eventHeight = isDrum
      ? 4 + velocity * 8
      : event.lane === 'chord'
        ? laneHeight * 0.38
        : 5 + velocity * 5;
    const futureAlpha = age < 0 ? clamp(1 + age / FUTURE_SECONDS, 0.18, 1) : 1;
    const oldAlpha = age > HISTORY_SECONDS - 0.8 ? clamp((HISTORY_SECONDS - age) / 0.8, 0, 1) : 1;

    ctx.save();
    ctx.globalAlpha = (0.28 + velocity * 0.55) * futureAlpha * oldAlpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isDrum ? 8 + velocity * 8 : 5;

    if (isDrum) {
      ctx.beginPath();
      ctx.arc(x, y, eventHeight * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const radius = event.lane === 'chord' ? 5 : 4;
      ctx.beginPath();
      ctx.roundRect(x, y - eventHeight * 0.5, eventWidth, eventHeight, radius);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.strokeStyle = playing ? 'rgba(224, 192, 144, 0.72)' : 'rgba(106, 90, 74, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(playheadX + 0.5, 0);
  ctx.lineTo(playheadX + 0.5, height);
  ctx.stroke();

  if (!playing) {
    ctx.fillStyle = 'rgba(200, 168, 122, 0.12)';
    ctx.fillRect(playheadX - 1, 0, 2, height);
  }
}

export function Visualizer({ engineRef, playing }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eventsRef = useRef<RenderEvent[]>([]);
  const lastCursorRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!playing) {
      eventsRef.current.length = 0;
      lastCursorRef.current = engineRef.current?.getVisualCursor() ?? 0;
      drawVisualizer(canvas, engineRef.current, false, eventsRef.current);
      return;
    }

    let raf = 0;
    let lastFrame = 0;
    let disposed = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frameMs = reducedMotion ? REDUCED_MOTION_FRAME_MS : FRAME_MS;

    const drawFrame = (timestamp: number) => {
      if (disposed) return;
      raf = window.requestAnimationFrame(drawFrame);
      if (document.visibilityState === 'hidden' || timestamp - lastFrame < frameMs) return;

      const engine = engineRef.current;
      if (engine) {
        lastCursorRef.current = consumeEvents(engine, lastCursorRef.current, eventsRef.current);
      }

      const now = Tone.now();
      pruneEvents(eventsRef.current, now);
      drawVisualizer(canvas, engine, true, eventsRef.current);
      lastFrame = timestamp;
    };

    drawVisualizer(canvas, engineRef.current, true, eventsRef.current);
    raf = window.requestAnimationFrame(drawFrame);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
    };
  }, [engineRef, playing]);

  return (
    <div className="visualizer" aria-label="Scrolling piano roll visualizer">
      <canvas ref={canvasRef} />
    </div>
  );
}
