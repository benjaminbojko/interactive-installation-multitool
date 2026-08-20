import { useMemo } from 'react';
import {
  PERSONAS,
  TABLE_HEIGHT_PRESETS,
  TABLE_SURFACE_MAX,
  TABLE_SURFACE_MIN,
  type PersonaId,
} from '../ergonomics/constants';
import { sizeFromDiagonal } from '../ergonomics/engine';
import { tableVerdict } from '../ergonomics/tableEngine';
import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { DimensionControls } from '../ui/DimensionControls';
import { fmtLen, fromInches, toInches } from '../ui/units';

const PERSONA_IDS: PersonaId[] = ['adult', 'child', 'wheelchair'];

// Screen sizes that actually get laid flat in a table. Its own list — a table
// panel has nothing to do with whatever the wall-mount tab is set to.
const SIZE_PRESETS: { label: string; diagonal: number; aspectW: number; aspectH: number }[] = [
  { label: '15.6" panel', diagonal: 15.6, aspectW: 16, aspectH: 9 },
  { label: '21.5" panel', diagonal: 21.5, aspectW: 16, aspectH: 9 },
  { label: '24" panel', diagonal: 24, aspectW: 16, aspectH: 9 },
  { label: '27" panel', diagonal: 27, aspectW: 16, aspectH: 9 },
  { label: '27" 3:2 panel', diagonal: 27, aspectW: 3, aspectH: 2 },
  { label: '32" panel', diagonal: 32, aspectW: 16, aspectH: 9 },
  { label: '32" 4:3 panel', diagonal: 32, aspectW: 4, aspectH: 3 },
  { label: '43" table', diagonal: 43, aspectW: 16, aspectH: 9 },
  { label: '55" table', diagonal: 55, aspectW: 16, aspectH: 9 },
  { label: '65" table', diagonal: 65, aspectW: 16, aspectH: 9 },
  { label: '75" table', diagonal: 75, aspectW: 16, aspectH: 9 },
  { label: '86" table', diagonal: 86, aspectW: 16, aspectH: 9 },
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function TableControls() {
  // Primitive selectors only, then derive the verdict in a memo (a fresh object
  // from a selector triggers an infinite getSnapshot loop — see VerdictPanel).
  const units = useConfigStore((s) => s.units);
  const diagonal = useConfigStore((s) => s.tableDiagonal);
  const aspectW = useConfigStore((s) => s.tableAspectW);
  const aspectH = useConfigStore((s) => s.tableAspectH);
  const tableHeight = useConfigStore((s) => s.tableHeight);
  const tableBezel = useConfigStore((s) => s.tableBezel);
  const tableShowReach = useConfigStore((s) => s.tableShowReach);
  const tableSeats = useConfigStore((s) => s.tableSeats);
  const personaId = useConfigStore((s) => s.personaId);
  const horizontalPixels = useConfigStore((s) => s.tableHorizontalPixels);
  const strictness = useConfigStore((s) => s.strictness);
  const set = useConfigStore((s) => s.set);

  const metric = units === 'metric';

  const v = useMemo(
    () =>
      tableVerdict({
        size: sizeFromDiagonal(diagonal, aspectW, aspectH),
        tableHeight,
        bezel: tableBezel,
        personaId,
        horizontalPixels,
        strictness,
      }),
    [diagonal, aspectW, aspectH, tableHeight, tableBezel, personaId, horizontalPixels, strictness],
  );

  // Border slider bounds in the active unit (0–12" / 0–30 cm).
  const bezVal = round(fromInches(tableBezel, units));

  // Surface-height slider bounds in the active unit (≈26–44" / 66–112 cm).
  const htMin = metric ? 66 : 26;
  const htMax = metric ? 112 : 44;
  const htVal = round(fromInches(tableHeight, units));

  return (
    <>
      <div className="panel">
        <h2>Table surface</h2>
        <p className="hint">
          A flat, face-up touchscreen you stand or sit at. Reach is a depth problem
          here — how far you can touch across the surface — not a wall-height one.
        </p>

        <div className="field">
          <div className="field-head">
            <span className="row-label">Surface height AFF</span>
            <span className="num-readout">{fmtLen(tableHeight, units)}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={htMin}
            max={htMax}
            step={metric ? 1 : 0.5}
            value={htVal}
            onChange={(e) => set('tableHeight', toInches(Number(e.target.value), units))}
          />
          <p className="hint">
            ADA seated-accessible work surface is {TABLE_SURFACE_MIN}–{TABLE_SURFACE_MAX}" — a
            wheelchair can pull under in that range.
          </p>
          <span className="seg presets">
            {TABLE_HEIGHT_PRESETS.map((p) => (
              <button
                key={p.label}
                className={Math.abs(tableHeight - p.in) < 0.5 ? 'on' : ''}
                title={`${p.in}" — ${fmtLen(p.in, units)}`}
                onClick={() => set('tableHeight', p.in)}
              >
                {p.label}
              </button>
            ))}
          </span>
        </div>

        <div className="field">
          <div className="field-head">
            <span className="row-label">Border / frame</span>
            <span className="num-readout">{fmtLen(tableBezel, units)}</span>
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={metric ? 30 : 12}
            step={metric ? 1 : 0.5}
            value={bezVal}
            onChange={(e) => set('tableBezel', toInches(Number(e.target.value), units))}
          />
          <p className="hint">
            Frame around the screen. You stand at its outer edge, so a wide border
            adds to the reach-across distance.
          </p>
        </div>

        <h2>Screen</h2>
        <Row label="Preset">
          <select
            value=""
            onChange={(e) => {
              const p = SIZE_PRESETS[Number(e.target.value)];
              if (!p) return;
              set('tableDiagonal', p.diagonal);
              set('tableAspectW', p.aspectW);
              set('tableAspectH', p.aspectH);
            }}
          >
            <option value="">Choose…</option>
            {SIZE_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>

        <DimensionControls
          value={{ diagonal, aspectW, aspectH }}
          onChange={(d) => {
            set('tableDiagonal', d.diagonal);
            set('tableAspectW', d.aspectW);
            set('tableAspectH', d.aspectH);
          }}
          note={
            <p className="hint">
              Laid flat, the screen's shorter dimension lies away from you — that's the{' '}
              <strong>{fmtLen(v.depth, units)}</strong> you reach across. Swap the aspect to
              rotate it.
            </p>
          }
        />

        <Row label="Horizontal pixels">
          <input
            type="number"
            min={0}
            value={horizontalPixels}
            onChange={(e) => set('tableHorizontalPixels', Number(e.target.value))}
          />
        </Row>

        <h2>Who's using it</h2>
        <Row label="Viewer">
          <span className="seg">
            {PERSONA_IDS.map((id) => (
              <button
                key={id}
                className={personaId === id ? 'on' : ''}
                onClick={() => set('personaId', id)}
              >
                {PERSONAS[id].label.split(' ')[0]}
              </button>
            ))}
          </span>
        </Row>
        <Row label="People around table">
          <input
            type="number"
            min={1}
            max={6}
            value={tableSeats}
            onChange={(e) => set('tableSeats', Math.max(1, Math.min(6, Math.round(Number(e.target.value)))))}
          />
        </Row>
        <p className="hint">Up to 6 — two per long side, one per short side (3D view).</p>
        <label className="row">
          <span className="row-label">Show reach heatmap</span>
          <span className="row-control">
            <input
              type="checkbox"
              checked={tableShowReach}
              onChange={(e) => set('tableShowReach', e.target.checked)}
            />
          </span>
        </label>

        <h2>Content</h2>
        <ContentUpload />
      </div>
    </>
  );
}
