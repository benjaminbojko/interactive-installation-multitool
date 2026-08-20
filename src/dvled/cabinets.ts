// Cabinet-level build math for the LED wall. A dvLED wall isn't a continuous
// sheet of pixels — it's a grid of cabinets, and each cabinet carries a whole,
// fixed pixel count (a 500 mm cabinet is 192 px at P2.6, 200 px at P2.5,
// 128 px at P3.9). Two consequences the rest of the app depends on:
//
//   • The real pitch is cabinet_mm / whole_pixels, not whatever round number you
//     typed. P2.6 on a 500 mm cabinet is physically P2.604.
//   • A target size is met by rounding the cabinet count UP. Rounding to nearest
//     (or truncating) is how you end up two pixels short of the canvas you spec'd.
//
// Lengths in mm where a name says Mm, inches otherwise. No React — unit-tested
// in cabinets.test.ts.

import { MM_PER_IN } from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';

export interface CabinetSpec {
  label: string;
  wMm: number;
  hMm: number;
}

/** Common indoor/outdoor cabinet formats. The 500 mm square dominates fine-pitch
 *  indoor product; the rest cover the usual 16:9 and 4:3 module families. */
export const CABINET_PRESETS: CabinetSpec[] = [
  { label: '500 × 500 mm', wMm: 500, hMm: 500 },
  { label: '500 × 1000 mm', wMm: 500, hMm: 1000 },
  { label: '1000 × 500 mm', wMm: 1000, hMm: 500 },
  { label: '600 × 337.5 mm (16:9)', wMm: 600, hMm: 337.5 },
  { label: '640 × 480 mm (4:3)', wMm: 640, hMm: 480 },
];

export interface CabinetBuild {
  /** Cabinets across / down, and their product. */
  cols: number;
  rows: number;
  totalCabinets: number;
  /** WHOLE pixels carried by one cabinet. Never fractional. */
  pxPerCabX: number;
  pxPerCabY: number;
  /** The pitch the whole-pixel count actually implies — feeds all the optics. */
  pitchMm: number;
  /** The pitch the user asked for. */
  nominalPitchMm: number;
  /** The wall you can actually build, in inches. */
  builtWidthIn: number;
  builtHeightIn: number;
  /** Exact wall resolution. Always integers, always ≥ the target implies. */
  totalPxX: number;
  totalPxY: number;
  /** How far the build overshoots the requested size (inches, ≥ 0). */
  overshootWidthIn: number;
  overshootHeightIn: number;
  /** True when the cabinet's height isn't a whole multiple of the derived pitch,
   *  so vertical and horizontal pitch disagree by more than 1%. */
  anisotropic: boolean;
}

const ok = (n: number) => Number.isFinite(n) && n > 0;

/** Clamp a cabinet to something buildable, so a cleared input can't divide by zero. */
export function safeCabinet(wMm: number, hMm: number): CabinetSpec {
  return {
    label: 'custom',
    wMm: ok(wMm) ? Math.min(4000, wMm) : 500,
    hMm: ok(hMm) ? Math.min(4000, hMm) : 500,
  };
}

/** Whole pixels per cabinet, and the true pitch that implies.
 *  The horizontal axis is authoritative: pick the pixel count from the cabinet
 *  width, then measure the vertical count against the pitch that produced. */
export function panelPixels(
  cab: CabinetSpec,
  nominalPitchMm: number,
): { pxPerCabX: number; pxPerCabY: number; pitchMm: number; anisotropic: boolean } {
  const pitch = ok(nominalPitchMm) ? nominalPitchMm : 2.5;
  const pxPerCabX = Math.max(1, Math.round(cab.wMm / pitch));
  const pitchMm = cab.wMm / pxPerCabX;
  const pxPerCabY = Math.max(1, Math.round(cab.hMm / pitchMm));
  const vPitch = cab.hMm / pxPerCabY;
  return {
    pxPerCabX,
    pxPerCabY,
    pitchMm,
    anisotropic: Math.abs(vPitch - pitchMm) / pitchMm > 0.01,
  };
}

/** Cap the grid so a pathological size (or a mistyped 0.01 mm cabinet) can't ask
 *  for a million cabinets and stall the render. */
const MAX_CABS = 200;

function finish(
  cols: number,
  rows: number,
  cab: CabinetSpec,
  nominalPitchMm: number,
  requestedWidthIn: number,
  requestedHeightIn: number,
): CabinetBuild {
  const p = panelPixels(cab, nominalPitchMm);
  const builtWidthIn = (cols * cab.wMm) / MM_PER_IN;
  const builtHeightIn = (rows * cab.hMm) / MM_PER_IN;
  return {
    cols,
    rows,
    totalCabinets: cols * rows,
    pxPerCabX: p.pxPerCabX,
    pxPerCabY: p.pxPerCabY,
    pitchMm: p.pitchMm,
    nominalPitchMm: ok(nominalPitchMm) ? nominalPitchMm : 2.5,
    builtWidthIn,
    builtHeightIn,
    totalPxX: cols * p.pxPerCabX,
    totalPxY: rows * p.pxPerCabY,
    overshootWidthIn: Math.max(0, builtWidthIn - requestedWidthIn),
    overshootHeightIn: Math.max(0, builtHeightIn - requestedHeightIn),
    anisotropic: p.anisotropic,
  };
}

/** Cabinet count needed to cover a span. Rounds up, but tolerates a hair of
 *  float slop: a size that came from an exact grid (cabinets → inches → mm)
 *  lands a few parts in 10^13 over the boundary, and must not buy a whole extra
 *  cabinet for it. 1e-9 of a cabinet is well under a micron. */
function ceilCabs(spanMm: number, cabMm: number): number {
  return Math.ceil(spanMm / cabMm - 1e-9);
}

/** Fit a cabinet grid around a target size. Always rounds the count UP — the
 *  build meets or exceeds what you asked for, never falls short of it. */
export function buildFromSize(
  widthIn: number,
  heightIn: number,
  cab: CabinetSpec,
  nominalPitchMm: number,
): CabinetBuild {
  const c = safeCabinet(cab.wMm, cab.hMm);
  const wMm = ok(widthIn) ? widthIn * MM_PER_IN : 0;
  const hMm = ok(heightIn) ? heightIn * MM_PER_IN : 0;
  const cols = Math.max(1, Math.min(MAX_CABS, ceilCabs(wMm, c.wMm)));
  const rows = Math.max(1, Math.min(MAX_CABS, ceilCabs(hMm, c.hMm)));
  return finish(cols, rows, c, nominalPitchMm, ok(widthIn) ? widthIn : 0, ok(heightIn) ? heightIn : 0);
}

/** Build from an explicit cabinet count — the size is exact output, no rounding. */
export function buildFromGrid(
  cols: number,
  rows: number,
  cab: CabinetSpec,
  nominalPitchMm: number,
): CabinetBuild {
  const c = safeCabinet(cab.wMm, cab.hMm);
  const nc = Math.max(1, Math.min(MAX_CABS, Math.round(ok(cols) ? cols : 1)));
  const nr = Math.max(1, Math.min(MAX_CABS, Math.round(ok(rows) ? rows : 1)));
  const b = finish(nc, nr, c, nominalPitchMm, 0, 0);
  // Requested === built in this direction, so there is no overshoot.
  return { ...b, overshootWidthIn: 0, overshootHeightIn: 0 };
}

/** Spreadsheet-style cabinet label: column letter(s) + 1-based row. */
export function cabinetLabel(col: number, row: number): string {
  let n = col;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${s}${row + 1}`;
}

/** Resolve the wall build from the LED tab's config, whichever way it's driven.
 *  In 'dimensions' mode the diagonal+aspect is a TARGET the grid rounds up to;
 *  in 'cabinets' mode the grid is the truth and the size falls out exactly. */
export function ledBuild(opts: {
  sizeMode: 'dimensions' | 'cabinets';
  diagonal: number;
  aspectW: number;
  aspectH: number;
  cabinetW: number;
  cabinetH: number;
  cols: number;
  rows: number;
  pitchMm: number;
}): CabinetBuild {
  const cab = safeCabinet(opts.cabinetW, opts.cabinetH);
  if (opts.sizeMode === 'cabinets') {
    return buildFromGrid(opts.cols, opts.rows, cab, opts.pitchMm);
  }
  const target = sizeFromDiagonal(opts.diagonal, opts.aspectW, opts.aspectH);
  return buildFromSize(target.width, target.height, cab, opts.pitchMm);
}
