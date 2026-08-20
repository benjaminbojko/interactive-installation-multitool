// The cabinet layout drawn over the LED preview: seams where the panels join,
// a heavier wall outline, and spreadsheet-style labels when there's room for
// them. Uses the same frame→wall mapping as ScaleOverlay, so the seams sit
// exactly where the shader put the wall at any distance or field of view.

import { cabinetLabel } from './cabinets';

export interface CabinetOverlayProps {
  cssW: number;
  cssH: number;
  /** Wall width ÷ visible span — the wall is centred and scaled by this. */
  wallFillFraction: number;
  cols: number;
  rows: number;
}

const SEAM = 'rgba(10,14,20,0.85)';
const EDGE = 'rgba(120,200,255,0.9)';

export function CabinetOverlay({ cssW, cssH, wallFillFraction, cols, rows }: CabinetOverlayProps) {
  if (cssW <= 0 || cssH <= 0 || cols < 1 || rows < 1) return null;

  const f = wallFillFraction;
  if (!Number.isFinite(f) || f <= 0) return null;

  // The wall rectangle on the canvas. It may overflow the frame when zoomed in.
  const wallX = (cssW * (1 - f)) / 2;
  const wallY = (cssH * (1 - f)) / 2;
  const wallW = cssW * f;
  const wallH = cssH * f;

  const cw = wallW / cols;
  const ch = wallH / rows;

  // Skip seams that fall outside the frame, and give up on the grid entirely
  // when the cabinets are too small to read as anything but noise.
  const visible = (x: number, span: number) => x > -1 && x < span + 1;
  const drawSeams = cw > 3 && ch > 3;
  const label = cw > 34 && ch > 18;

  const vSeams: number[] = [];
  const hSeams: number[] = [];
  if (drawSeams) {
    for (let i = 1; i < cols; i++) {
      const x = wallX + i * cw;
      if (visible(x, cssW)) vSeams.push(x);
    }
    for (let j = 1; j < rows; j++) {
      const y = wallY + j * ch;
      if (visible(y, cssH)) hSeams.push(y);
    }
  }

  const labels: { x: number; y: number; text: string }[] = [];
  if (label) {
    for (let j = 0; j < rows; j++) {
      const cy = wallY + (j + 0.5) * ch;
      if (!visible(cy, cssH)) continue;
      for (let i = 0; i < cols; i++) {
        const cx = wallX + (i + 0.5) * cw;
        if (!visible(cx, cssW)) continue;
        labels.push({ x: cx, y: cy, text: cabinetLabel(i, j) });
      }
    }
  }

  return (
    <svg className="dvled-overlay-svg" width={cssW} height={cssH} viewBox={`0 0 ${cssW} ${cssH}`}>
      {vSeams.map((x) => (
        <line key={`v${x}`} x1={x} y1={Math.max(0, wallY)} x2={x} y2={Math.min(cssH, wallY + wallH)}
          stroke={SEAM} strokeWidth={1.25} />
      ))}
      {hSeams.map((y) => (
        <line key={`h${y}`} x1={Math.max(0, wallX)} y1={y} x2={Math.min(cssW, wallX + wallW)} y2={y}
          stroke={SEAM} strokeWidth={1.25} />
      ))}
      <rect x={wallX} y={wallY} width={wallW} height={wallH} fill="none" stroke={EDGE} strokeWidth={1.5} />
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={l.y + 4} textAnchor="middle" className="dvled-overlay-label cab">
          {l.text}
        </text>
      ))}
    </svg>
  );
}
