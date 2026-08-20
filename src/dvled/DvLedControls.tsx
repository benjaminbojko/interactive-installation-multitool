import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { DimensionControls } from '../ui/DimensionControls';
import { fmtDist, fromInches, toInches } from '../ui/units';
import { CABINET_PRESETS, ledBuild } from './cabinets';
import { emitterWidthForPitch, pitchFillFraction } from './optics';

// LED-wall presets — target diagonal, a typical pitch, and the cabinet the
// product family actually ships on.
const PRESETS: {
  label: string;
  diagonal: number;
  aspectW: number;
  aspectH: number;
  pitch: number;
  cabW: number;
  cabH: number;
}[] = [
  { label: 'Meeting room — 6 ft, P1.2', diagonal: 83, aspectW: 16, aspectH: 9, pitch: 1.2, cabW: 600, cabH: 337.5 },
  { label: 'Retail header — 8 ft, P1.5', diagonal: 110, aspectW: 16, aspectH: 9, pitch: 1.5, cabW: 500, cabH: 500 },
  { label: 'Lobby wall — 12 ft, P2.5', diagonal: 165, aspectW: 16, aspectH: 9, pitch: 2.5, cabW: 500, cabH: 500 },
  { label: 'Atrium wall — 16 ft, P2.9', diagonal: 220, aspectW: 16, aspectH: 9, pitch: 2.9, cabW: 500, cabH: 500 },
  { label: 'Stage backdrop — 24 ft, P3.9', diagonal: 330, aspectW: 16, aspectH: 9, pitch: 3.9, cabW: 500, cabH: 500 },
  { label: 'Arena board — 40 ft, P6', diagonal: 550, aspectW: 16, aspectH: 9, pitch: 6, cabW: 1000, cabH: 500 },
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

const clampCount = (n: number) => Math.max(1, Math.min(200, Math.round(n) || 1));

export function DvLedControls() {
  const units = useConfigStore((s) => s.units);
  const set = useConfigStore((s) => s.set);
  const ledDiagonal = useConfigStore((s) => s.ledDiagonal);
  const ledAspectW = useConfigStore((s) => s.ledAspectW);
  const ledAspectH = useConfigStore((s) => s.ledAspectH);
  const ledPitchMm = useConfigStore((s) => s.ledPitchMm);
  const ledSizeMode = useConfigStore((s) => s.ledSizeMode);
  const ledCabinetW = useConfigStore((s) => s.ledCabinetW);
  const ledCabinetH = useConfigStore((s) => s.ledCabinetH);
  const ledCabCols = useConfigStore((s) => s.ledCabCols);
  const ledCabRows = useConfigStore((s) => s.ledCabRows);
  const ledView = useConfigStore((s) => s.ledView);
  const dvledDistance = useConfigStore((s) => s.dvledDistance);
  const dvledFov = useConfigStore((s) => s.dvledFov);
  const dvledLockFill = useConfigStore((s) => s.dvledLockFill);
  const fillFactor = useConfigStore((s) => s.fillFactor);
  const ledShape = useConfigStore((s) => s.ledShape);
  const dvledShowScale = useConfigStore((s) => s.dvledShowScale);

  const metric = units === 'metric';

  // Distance slider bounds, in the active unit. 1–80 ft (≈0.3–24 m).
  const distMin = metric ? 30 : 12;
  const distMax = metric ? 2400 : 960;
  const distVal = round(fromInches(dvledDistance, units));

  const build = ledBuild({
    sizeMode: ledSizeMode,
    diagonal: ledDiagonal,
    aspectW: ledAspectW,
    aspectH: ledAspectH,
    cabinetW: ledCabinetW,
    cabinetH: ledCabinetH,
    cols: ledCabCols,
    rows: ledCabRows,
    pitchMm: ledPitchMm,
  });

  // Fill derived from the BUILT pitch (used when "Fill from pitch" is on).
  const lockedFill = pitchFillFraction(build.pitchMm);
  const emitterMm = emitterWidthForPitch(build.pitchMm);

  const cabIdx = CABINET_PRESETS.findIndex(
    (c) => c.wMm === ledCabinetW && c.hMm === ledCabinetH,
  );
  const overshoots = build.overshootWidthIn > 0.05 || build.overshootHeightIn > 0.05;

  // What the grid actually builds — the same sentence in both size modes, so
  // switching between them doesn't change what you're reading.
  const buildNote = (
    <>
      <p className="hint">
        → <strong>{build.cols} × {build.rows}</strong> cabinets ({build.totalCabinets} total) ·
        builds <strong>{fmtDist(build.builtWidthIn, units)} × {fmtDist(build.builtHeightIn, units)}</strong> ·{' '}
        <strong>{build.totalPxX.toLocaleString()} × {build.totalPxY.toLocaleString()} px</strong>
      </p>
      {ledSizeMode === 'dimensions' && overshoots && (
        <p className="hint warn">
          ⚠ Cabinets don't cut, so the build rounds <em>up</em> — this wall lands{' '}
          {fmtDist(build.overshootWidthIn, units)} wider and {fmtDist(build.overshootHeightIn, units)} taller
          than your target. The preview shows what you'd actually get.{' '}
          <button
            className="link-btn"
            onClick={() => {
              set('ledDiagonal', Math.hypot(build.builtWidthIn, build.builtHeightIn));
              set('ledAspectW', build.builtWidthIn);
              set('ledAspectH', build.builtHeightIn);
            }}
          >
            Snap dimensions to the grid
          </button>
        </p>
      )}
    </>
  );

  return (
    <div className="panel">
      <h2>LED wall</h2>

      <Row label="Preset">
        <select
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            set('ledSizeMode', 'dimensions');
            set('ledDiagonal', p.diagonal);
            set('ledAspectW', p.aspectW);
            set('ledAspectH', p.aspectH);
            set('ledPitchMm', p.pitch);
            set('ledCabinetW', p.cabW);
            set('ledCabinetH', p.cabH);
          }}
        >
          <option value="">Choose…</option>
          {PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Size by">
        <span className="seg">
          <button
            className={ledSizeMode === 'dimensions' ? 'on' : ''}
            onClick={() => set('ledSizeMode', 'dimensions')}
          >
            Dimensions
          </button>
          <button
            className={ledSizeMode === 'cabinets' ? 'on' : ''}
            onClick={() => {
              // Carry the current build across, so the toggle never jumps.
              set('ledCabCols', build.cols);
              set('ledCabRows', build.rows);
              set('ledSizeMode', 'cabinets');
            }}
          >
            Cabinets
          </button>
        </span>
      </Row>

      {ledSizeMode === 'dimensions' ? (
        <DimensionControls
          value={{ diagonal: ledDiagonal, aspectW: ledAspectW, aspectH: ledAspectH }}
          onChange={(d) => {
            set('ledDiagonal', d.diagonal);
            set('ledAspectW', d.aspectW);
            set('ledAspectH', d.aspectH);
          }}
          note={buildNote}
        />
      ) : (
        <div className="dims">
          <div className="dims-head">
            <span className="row-label">Cabinet count</span>
          </div>
          <label className="dims-row">
            <span className="row-label">Across</span>
            <span className="dims-field">
              <input
                type="number"
                min={1}
                max={200}
                style={{ width: 72 }}
                value={ledCabCols}
                onChange={(e) => set('ledCabCols', clampCount(Number(e.target.value)))}
              />
              <span className="unit">cab</span>
            </span>
          </label>
          <label className="dims-row">
            <span className="row-label">Down</span>
            <span className="dims-field">
              <input
                type="number"
                min={1}
                max={200}
                style={{ width: 72 }}
                value={ledCabRows}
                onChange={(e) => set('ledCabRows', clampCount(Number(e.target.value)))}
              />
              <span className="unit">cab</span>
            </span>
          </label>
          {buildNote}
        </div>
      )}

      <Row label="Cabinet size">
        <select
          value={cabIdx >= 0 ? String(cabIdx) : 'custom'}
          onChange={(e) => {
            const c = CABINET_PRESETS[Number(e.target.value)];
            if (!c) return; // "Custom…" — keep the current mm values and reveal the fields
            set('ledCabinetW', c.wMm);
            set('ledCabinetH', c.hMm);
          }}
        >
          {CABINET_PRESETS.map((c, i) => (
            <option key={c.label} value={i}>
              {c.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </Row>

      {cabIdx < 0 && (
        <Row label="Cabinet W × H (mm)">
          <span className="dims-field">
            <input
              type="number"
              min={1}
              step={10}
              style={{ width: 66 }}
              value={ledCabinetW}
              onChange={(e) => set('ledCabinetW', Number(e.target.value))}
            />
            <span className="unit">×</span>
            <input
              type="number"
              min={1}
              step={10}
              style={{ width: 66 }}
              value={ledCabinetH}
              onChange={(e) => set('ledCabinetH', Number(e.target.value))}
            />
          </span>
        </Row>
      )}

      <Row label="Pixel pitch (mm)">
        <input
          type="number"
          step={0.1}
          min={0.4}
          value={ledPitchMm}
          onChange={(e) => set('ledPitchMm', Number(e.target.value))}
        />
      </Row>
      <p className="hint">
        A cabinet carries a whole number of pixels, so the pitch you get is the one that divides
        it evenly: {ledCabinetW} mm ÷ P{ledPitchMm} → <strong>{build.pxPerCabX} × {build.pxPerCabY} px
        per cabinet</strong> → true pitch <strong>P{build.pitchMm.toFixed(3)}</strong>.
      </p>
      {build.anisotropic && (
        <p className="hint warn">
          ⚠ {ledCabinetH} mm isn't a whole multiple of P{build.pitchMm.toFixed(3)} — the vertical
          pitch works out to P{(ledCabinetH / build.pxPerCabY).toFixed(3)}, so this cabinet /
          pitch pairing isn't a real product. Pick a pitch that divides both edges.
        </p>
      )}

      <h2>Your viewpoint</h2>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Viewing distance</span>
          <span className="num-readout">{fmtDist(dvledDistance, units)}</span>
        </div>
        <input
          className="slider"
          type="range"
          min={distMin}
          max={distMax}
          step={metric ? 5 : 2}
          value={distVal}
          onChange={(e) => set('dvledDistance', toInches(Number(e.target.value), units))}
        />
      </div>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Field of view</span>
          <span className="num-readout">{dvledFov}°</span>
        </div>
        <input
          className="slider"
          type="range"
          min={15}
          max={90}
          step={1}
          value={dvledFov}
          onChange={(e) => set('dvledFov', Number(e.target.value))}
        />
        <p className="hint">How wide a cone of the wall the frame represents (~40° ≈ a relaxed, eyes-forward gaze).</p>
      </div>

      <h2>Panel look</h2>

      <label className="check">
        <input
          type="checkbox"
          checked={dvledLockFill}
          onChange={(e) => set('dvledLockFill', e.target.checked)}
        />
        Fill from pitch (realistic)
      </label>

      <div className="field">
        <div className="field-head">
          <span className="row-label">Fill factor</span>
          <span className="num-readout">
            {Math.round((dvledLockFill ? lockedFill : fillFactor) * 100)}%
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.1}
          max={0.95}
          step={0.05}
          disabled={dvledLockFill}
          value={dvledLockFill ? lockedFill : fillFactor}
          onChange={(e) => set('fillFactor', Number(e.target.value))}
        />
        <p className="hint">
          {dvledLockFill
            ? `Derived from the pitch — emitter ≈ ${emitterMm.toFixed(1)} mm in the ${build.pitchMm.toFixed(2)} mm cell. The diode grows slower than the pitch, so coarse pitches show more black gap. Brightness stays constant.`
            : 'How much of each pixel the emitter covers. Lower = wider black grid (stronger screen-door up close).'}
        </p>
      </div>

      <Row label="LED shape">
        <span className="seg">
          <button className={ledShape === 'circle' ? 'on' : ''} onClick={() => set('ledShape', 'circle')}>
            Round
          </button>
          <button className={ledShape === 'square' ? 'on' : ''} onClick={() => set('ledShape', 'square')}>
            Square
          </button>
        </span>
      </Row>

      <h2>What the wall shows</h2>
      <Row label="View">
        <span className="seg">
          <button className={ledView === 'content' ? 'on' : ''} onClick={() => set('ledView', 'content')}>
            Content
          </button>
          <button className={ledView === 'cabinets' ? 'on' : ''} onClick={() => set('ledView', 'cabinets')}>
            Cabinets
          </button>
        </span>
      </Row>
      <p className="hint">
        {ledView === 'cabinets'
          ? 'Content off — a bare wall with the cabinet seams drawn on it, so you can see the build and where the joins land.'
          : 'Drive the uploaded image or the test pattern onto the wall.'}
      </p>

      <h2>Scale reference</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={dvledShowScale}
          onChange={(e) => set('dvledShowScale', e.target.checked)}
        />
        Show person + scale bar
      </label>

      <h2>Content</h2>
      <ContentUpload />
    </div>
  );
}
