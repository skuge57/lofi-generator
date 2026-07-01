import { useEffect, useRef, type RefObject } from 'react';
import type { LofiEngine } from '../engine/lofiEngine';

const FRAME_MS = 1000 / 45;
const REDUCED_MOTION_FRAME_MS = 1000 / 15;
const MIN_DPR = 1;
const MAX_DPR = 2;
const SMOOTHING = 0.25;

interface Props {
  engineRef: RefObject<LofiEngine | null>;
  playing: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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

function drawFrame(
  canvas: HTMLCanvasElement,
  values: Float32Array | null,
  smoothed: Float32Array,
  playing: boolean,
): void {
  const ctx = resizeCanvas(canvas);
  if (!ctx) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const midY = height / 2;
  const maxAmp = height * 0.46;

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#181511');
  bg.addColorStop(0.5, '#1c1814');
  bg.addColorStop(1, '#151210');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(200, 168, 122, 0.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY + 0.5);
  ctx.lineTo(width, midY + 0.5);
  ctx.stroke();

  if (!values || values.length === 0) {
    ctx.fillStyle = 'rgba(200, 168, 122, 0.14)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(playing ? '…' : 'press play', width / 2, midY);
    return;
  }

  const n = values.length;
  for (let i = 0; i < n; i++) {
    smoothed[i] += (values[i] - smoothed[i]) * (1 - SMOOTHING);
  }

  const step = n / width;
  const points: { x: number; y: number }[] = new Array(width);
  for (let x = 0; x < width; x++) {
    const idx = Math.min(n - 1, Math.floor(x * step));
    const v = smoothed[idx];
    points[x] = { x, y: midY - v * maxAmp };
  }

  const fill = ctx.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, 'rgba(200, 168, 122, 0.18)');
  fill.addColorStop(0.5, 'rgba(200, 168, 122, 0.36)');
  fill.addColorStop(1, 'rgba(200, 168, 122, 0.18)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  for (const p of points) ctx.lineTo(p.x, p.y);
  for (let x = width - 1; x >= 0; x--) {
    const p = points[x];
    ctx.lineTo(p.x, midY + (midY - p.y));
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = playing ? 'rgba(232, 200, 150, 0.9)' : 'rgba(200, 168, 122, 0.35)';
  ctx.lineWidth = 1.3;
  ctx.shadowColor = 'rgba(232, 200, 150, 0.4)';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(200, 168, 122, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const mirroredY = midY + (midY - p.y);
    if (i === 0) ctx.moveTo(p.x, mirroredY);
    else ctx.lineTo(p.x, mirroredY);
  }
  ctx.stroke();
}

export function Waveform({ engineRef, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!playing) {
      if (smoothedRef.current) smoothedRef.current.fill(0);
      drawFrame(canvas, null, smoothedRef.current ?? new Float32Array(0), false);
      return;
    }

    let raf = 0;
    let lastFrame = 0;
    let disposed = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frameMs = reducedMotion ? REDUCED_MOTION_FRAME_MS : FRAME_MS;

    const tick = (timestamp: number) => {
      if (disposed) return;
      raf = window.requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden' || timestamp - lastFrame < frameMs) return;

      const engine = engineRef.current;
      const values = engine ? engine.getWaveform() : null;
      if (values && (!smoothedRef.current || smoothedRef.current.length !== values.length)) {
        smoothedRef.current = new Float32Array(values.length);
      }
      drawFrame(canvas, values, smoothedRef.current!, true);
      lastFrame = timestamp;
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
    };
  }, [engineRef, playing]);

  return (
    <div className="waveform" aria-label="Master output waveform">
      <canvas ref={canvasRef} />
    </div>
  );
}
