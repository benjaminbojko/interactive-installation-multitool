// One dimension control reused on every tab: Width / Height / Diagonal fields
// plus a visible aspect-ratio lock. The store keeps diagonal+aspect; all the
// translation lives in ergonomics/dimensions.ts, so this is just wiring.

import { useState } from 'react';
import { sizeFromDiagonal } from '../ergonomics/engine';
import {
  setAspect,
  setDiagonalIn,
  setHeightIn,
  setWidthIn,
  swapAspect,
  type Dims,
} from '../ergonomics/dimensions';
import { useConfigStore } from '../store/useConfigStore';
import { formatAspect } from './units';

const M_PER_IN = 0.0254;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Free-typing length field. Metric shows METRES (displays are metre-scale),
 *  imperial shows inches. Holds a local text draft so you can clear it and type
 *  decimals freely, and commits on blur / Enter — ignoring empty/non-positive
 *  input. Avoids the per-keystroke store rewrite that made the old controlled
 *  number field impossible to edit, especially in metric. */
export function DimInput({
  inches,
  metric,
  onCommit,
  width = 72,
}: {
  inches: number;
  metric: boolean;
  onCommit: (inches: number) => void;
  width?: number;
}) {
  const display = metric ? round2(inches * M_PER_IN) : round1(inches);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n) && n > 0) {
      onCommit(metric ? n / M_PER_IN : n);
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      style={{ width }}
      value={draft ?? String(display)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

const ASPECT_PRESETS: [number, number][] = [
  [16, 9],
  [4, 3],
  [1, 1],
  [21, 9],
];

/** Each screen tab owns its own {diagonal, aspectW, aspectH} trio in the store,
 *  so the caller supplies the value and the writer — this component holds no
 *  screen state of its own beyond the aspect lock. */
export function DimensionControls({
  value,
  onChange,
  note,
}: {
  value: Dims;
  onChange: (d: Dims) => void;
  note?: React.ReactNode;
}) {
  const units = useConfigStore((s) => s.units);
  const metric = units === 'metric';
  const [lock, setLock] = useState(true);

  const { diagonal, aspectW, aspectH } = value;
  const cur: Dims = value;
  const size = sizeFromDiagonal(diagonal, aspectW, aspectH);
  const unit = metric ? 'm' : 'in';

  const apply = onChange;

  return (
    <div className="dims">
      <div className="dims-head">
        <span className="row-label">Dimensions</span>
        <button
          className={`dims-lock ${lock ? 'on' : ''}`}
          onClick={() => setLock((l) => !l)}
          title={
            lock
              ? 'Aspect locked — editing one field scales the others to keep the shape'
              : 'Aspect unlocked — width and height are independent (editing one changes the shape)'
          }
        >
          {lock ? '🔒' : '🔓'} aspect
        </button>
      </div>

      <label className="dims-row">
        <span className="row-label">Width</span>
        <span className="dims-field">
          <DimInput inches={size.width} metric={metric} onCommit={(w) => apply(setWidthIn(cur, w, lock))} />
          <span className="unit">{unit}</span>
        </span>
      </label>
      <label className="dims-row">
        <span className="row-label">Height</span>
        <span className="dims-field">
          <DimInput inches={size.height} metric={metric} onCommit={(h) => apply(setHeightIn(cur, h, lock))} />
          <span className="unit">{unit}</span>
        </span>
      </label>
      <label className="dims-row">
        <span className="row-label">Diagonal</span>
        <span className="dims-field">
          <DimInput inches={diagonal} metric={metric} onCommit={(d) => apply(setDiagonalIn(cur, d))} />
          <span className="unit">{unit}</span>
        </span>
      </label>

      <div className="dims-aspect">
        <span className="dims-ratio" title="Aspect ratio">{formatAspect(aspectW, aspectH)}</span>
        <button className="dims-swap" onClick={() => apply(swapAspect(cur))} title="Swap portrait / landscape">
          ⇄
        </button>
        <span className="seg sm dims-chips">
          {ASPECT_PRESETS.map(([w, h]) => (
            <button key={`${w}:${h}`} onClick={() => apply(setAspect(cur, w, h))}>
              {w}:{h}
            </button>
          ))}
        </span>
      </div>

      {note}
    </div>
  );
}
