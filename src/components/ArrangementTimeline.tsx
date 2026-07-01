import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { getSongForm } from '../engine/musicTheory';
import type { SectionInfo, SongFormId, SongSection } from '../engine/types';

interface Props {
  sectionInfo: SectionInfo | null;
  songForm: boolean;
  songFormId: SongFormId;
  playing: boolean;
}

interface Layout {
  section: SongSection;
  index: number;
  startBar: number;
  endBar: number;
  energy: number;
}

const VIEW_HEIGHT = 72;
const CONTOUR_TOP = 14;
const CONTOUR_BOTTOM = 58;
const CONTOUR_RANGE = CONTOUR_BOTTOM - CONTOUR_TOP;
const CORNER_RADIUS = 4;

const SECTION_COLORS: Record<string, { fill: string; fillActive: string; stroke: string; label: string }> = {
  intro:  { fill: '#2a231d', fillActive: '#3d3226', stroke: '#4a3e33', label: 'Intro' },
  A:      { fill: '#3a2a1c', fillActive: '#6e4a2a', stroke: '#8a6238', label: 'A' },
  B:      { fill: '#4a2a1e', fillActive: '#a25230', stroke: '#c26640', label: 'B' },
  C:      { fill: '#2a2434', fillActive: '#4a3a68', stroke: '#6a548a', label: 'C' },
  bridge: { fill: '#1e2f2a', fillActive: '#2f5148', stroke: '#4a7a6c', label: 'Bridge' },
  outro:  { fill: '#252220', fillActive: '#3a332d', stroke: '#4a4238', label: 'Outro' },
};

function colorsFor(id: string) {
  return SECTION_COLORS[id] ?? SECTION_COLORS.A;
}

function buildLayout(sections: SongSection[]): { rows: Layout[]; totalBars: number } {
  let bar = 0;
  const rows: Layout[] = sections.map((section, index) => {
    const startBar = bar;
    bar += section.bars;
    return {
      section,
      index,
      startBar,
      endBar: bar,
      energy: Math.max(0.15, Math.min(1, section.energy ?? 0.6)),
    };
  });
  return { rows, totalBars: bar };
}

function energyY(energy: number): number {
  return CONTOUR_BOTTOM - CONTOUR_RANGE * energy;
}

function sectionPath(row: Layout, totalBars: number, width: number): string {
  const x0 = (row.startBar / totalBars) * width;
  const x1 = (row.endBar / totalBars) * width;
  const w = Math.max(2, x1 - x0);
  const y = energyY(row.energy);
  const h = CONTOUR_BOTTOM - y;
  const r = Math.min(CORNER_RADIUS, w / 2, h / 2);
  return [
    `M ${x0} ${CONTOUR_BOTTOM}`,
    `L ${x0} ${y + r}`,
    `Q ${x0} ${y} ${x0 + r} ${y}`,
    `L ${x1 - r} ${y}`,
    `Q ${x1} ${y} ${x1} ${y + r}`,
    `L ${x1} ${CONTOUR_BOTTOM}`,
    'Z',
  ].join(' ');
}

function useAnimatedProgress(sectionInfo: SectionInfo | null, playing: boolean): number {
  const [progress, setProgress] = useState(0);
  const barStartRef = useRef<number>(0);
  const currentBarRef = useRef<string>('');
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!playing || !sectionInfo) {
      cancelAnimationFrame(rafRef.current);
      setProgress(sectionInfo ? sectionInfo.barInSection : 0);
      return;
    }

    const key = `${sectionInfo.index}:${sectionInfo.barInSection}`;
    if (key !== currentBarRef.current) {
      currentBarRef.current = key;
      barStartRef.current = performance.now();
    }

    const tick = () => {
      const elapsed = (performance.now() - barStartRef.current) / 1000;
      const bpm = Math.max(1, Tone.getTransport().bpm.value);
      const secondsPerBar = (60 / bpm) * 4;
      const frac = Math.min(0.999, elapsed / secondsPerBar);
      setProgress(sectionInfo.barInSection + frac);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sectionInfo, playing]);

  return progress;
}

export function ArrangementTimeline({ sectionInfo, songForm, songFormId, playing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const subBarProgress = useAnimatedProgress(sectionInfo, playing);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!songForm) return null;

  const { rows, totalBars } = buildLayout(getSongForm(songFormId).sections);
  const activeIndex = sectionInfo?.index ?? -1;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
  const playheadBar = activeRow
    ? activeRow.startBar + Math.min(activeRow.section.bars - 0.001, Math.max(0, subBarProgress))
    : 0;
  const playheadX = (playheadBar / totalBars) * width;

  return (
    <div className="arrangement-timeline" ref={containerRef} role="img" aria-label="Song arrangement timeline">
      <svg
        viewBox={`0 0 ${width} ${VIEW_HEIGHT}`}
        width="100%"
        height={VIEW_HEIGHT}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="timeline-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141210" />
            <stop offset="1" stopColor="#1a1612" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={width} height={VIEW_HEIGHT} fill="url(#timeline-bg)" rx={6} />

        <line
          x1={0}
          x2={width}
          y1={CONTOUR_BOTTOM + 0.5}
          y2={CONTOUR_BOTTOM + 0.5}
          stroke="#2a2420"
          strokeWidth={1}
        />

        {Array.from({ length: totalBars + 1 }, (_, i) => {
          const x = (i / totalBars) * width;
          const major = i % 4 === 0;
          return (
            <line
              key={`tick-${i}`}
              x1={x}
              x2={x}
              y1={CONTOUR_BOTTOM + 1}
              y2={CONTOUR_BOTTOM + (major ? 6 : 3)}
              stroke={major ? '#3a2f26' : '#26211d'}
              strokeWidth={1}
            />
          );
        })}

        {rows.map(row => {
          const isActive = row.index === activeIndex;
          const c = colorsFor(row.section.id);
          return (
            <path
              key={`section-${row.index}`}
              d={sectionPath(row, totalBars, width)}
              fill={isActive ? c.fillActive : c.fill}
              stroke={isActive ? c.stroke : 'transparent'}
              strokeWidth={1}
              style={{ transition: 'fill 240ms ease, stroke 240ms ease' }}
            />
          );
        })}

        {rows.map(row => {
          const x0 = (row.startBar / totalBars) * width;
          const x1 = (row.endBar / totalBars) * width;
          const w = x1 - x0;
          if (w < 30) return null;
          const isActive = row.index === activeIndex;
          const c = colorsFor(row.section.id);
          const cx = x0 + w / 2;
          const labelY = energyY(row.energy) - 3;
          return (
            <text
              key={`label-${row.index}`}
              x={cx}
              y={labelY}
              textAnchor="middle"
              fontSize={9}
              fontFamily="Georgia, serif"
              letterSpacing="0.08em"
              fill={isActive ? '#e8c896' : '#6a5a4a'}
              style={{ textTransform: 'uppercase', transition: 'fill 240ms ease' }}
            >
              {row.section.label || c.label}
            </text>
          );
        })}

        {rows.map(row => {
          if (!row.section.fillOnLastBar) return null;
          const barX = ((row.endBar - 0.5) / totalBars) * width;
          const y = energyY(row.energy) + 4;
          return (
            <polygon
              key={`fill-${row.index}`}
              points={`${barX},${y} ${barX - 3},${y - 5} ${barX + 3},${y - 5}`}
              fill="#e0a05f"
              opacity={0.85}
            />
          );
        })}

        {rows.map(row => {
          const mutes = row.section.mutes ?? [];
          if (mutes.length === 0) return null;
          const x0 = (row.startBar / totalBars) * width;
          const x1 = (row.endBar / totalBars) * width;
          const w = x1 - x0;
          if (w < 22) return null;
          const cx = x0 + w / 2;
          const startX = cx - (mutes.length - 1) * 3;
          const y = CONTOUR_BOTTOM - 5;
          return (
            <g key={`mutes-${row.index}`}>
              {mutes.map((m, i) => (
                <circle
                  key={`${row.index}-${m}`}
                  cx={startX + i * 6}
                  cy={y}
                  r={1.5}
                  fill="#8a6a52"
                  opacity={0.7}
                />
              ))}
            </g>
          );
        })}

        {sectionInfo && (
          <>
            <line
              x1={playheadX}
              x2={playheadX}
              y1={CONTOUR_TOP - 4}
              y2={CONTOUR_BOTTOM + 8}
              stroke="#e8c896"
              strokeWidth={1.4}
              opacity={playing ? 0.92 : 0.5}
            />
            <circle
              cx={playheadX}
              cy={CONTOUR_TOP - 4}
              r={2.5}
              fill="#e8c896"
              opacity={playing ? 1 : 0.5}
            />
          </>
        )}
      </svg>

      {sectionInfo && (
        <div className="timeline-readout" aria-live="polite">
          <span className="timeline-readout-label">{sectionInfo.label || colorsFor(sectionInfo.id).label}</span>
          <span className="timeline-readout-pos">
            bar {sectionInfo.barInSection + 1} / {sectionInfo.totalBars}
          </span>
        </div>
      )}
    </div>
  );
}
