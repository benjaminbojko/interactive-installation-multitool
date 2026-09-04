import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { ModelControls } from '../ui/ModelControls';
import { ProjectorListCard } from './ProjectorListCard';
import { Card } from '../ui/Card';
import { fmtDist, fmtLen, fromInches, toInches } from '../ui/units';
import { distanceFromWidth, widthFromDistance } from './projectionMath';
import { depthOfFocusIn } from './focusOptics';

// Projector / lens presets — throw ratios pinned to real Barco lenses (full
// catalog, barco.json: 236 projector bodies / 2111 lens entries), one
// representative throw value per lens's published min–max zoom range, cross-
// checked against active (non-EOL) listings only. The focus band is no
// longer a hand-picked percentage — it's computed from a physical
// depth-of-focus model (see ./focusOptics.ts, a reversed-camera DOF formula)
// driven by each preset's throw ratio and resolution.
const PRESETS: {
  label: string;
  throw: number;
  lumens: number;
  resW: number;
  resH: number;
}[] = [
  // ILD 0.37 UST, R9803077 — the most common Barco-branded UST throw ratio
  // (0.37:1 also appears on GLD 0.37-0.40 UST 90°/F80 and G LENS 0.37-0.4:1
  // UST/G-series). The catalog's single shortest lens, FLD+ 0.26:1 (EN68,
  // F400-N4K), isn't actually Barco-branded "UST" — it's an outlier, not
  // representative.
  { label: 'Ultra-short-throw, 1080p — 0.37 / 4k lm', throw: 0.37, lumens: 4000, resW: 1920, resH: 1080 },
  // GLD 0.8-1.0:1, R98017241, F80-4K7 (throw 0.80–1.06)
  { label: 'Short-throw, 1080p — 0.9 / 4k lm', throw: 0.9, lumens: 4000, resW: 1920, resH: 1080 },
  // GLD 1.0-1.35:1, R98017221, F80-4K7 (throw 1.00–1.43)
  { label: 'Install 4K — 1.2 / 10k lm', throw: 1.2, lumens: 10000, resW: 3840, resH: 2160 },
  // GLD 1.35-2.0:1, R98017201, F80-4K7 (throw 1.35–2.12)
  { label: 'Standard, 1080p — 1.5 / 5k lm', throw: 1.5, lumens: 5000, resW: 1920, resH: 1080 },
  // GLD 2.0-3.0:1, R98017211, F80-4K7 (throw 2.00–3.18)
  { label: 'Long-throw event — 2.5 / 20k lm', throw: 2.5, lumens: 20000, resW: 1920, resH: 1200 },
];

function Row({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="row" title={title}>
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function ProjectionControls() {
  const s = useConfigStore();
  const units = s.units;
  const metric = units === 'metric';

  // Keep distance and width two ends of one number: editing either (or the
  // throw ratio) recomputes the other so the store never drifts. Also push
  // the resulting throw distance to the selected projector's own posIn[2] —
  // required for its auto-focus band (see withAutoFocus) to see the right
  // distance regardless of which of distance/width/throw-ratio was edited.
  function pushDistanceToSelected(distIn: number) {
    if (!s.selectedProjectorId) return;
    const p = s.projectors.find((x) => x.id === s.selectedProjectorId);
    if (p) s.updateProjector(p.id, { posIn: [p.posIn[0], p.posIn[1], distIn] });
  }
  function setDistance(distIn: number) {
    s.set('projDistance', distIn);
    s.set('projWidth', widthFromDistance(distIn, s.projThrowRatio));
    pushDistanceToSelected(distIn);
  }
  function setWidth(widthIn: number) {
    s.set('projWidth', widthIn);
    const distIn = distanceFromWidth(widthIn, s.projThrowRatio);
    s.set('projDistance', distIn);
    pushDistanceToSelected(distIn);
  }
  function setThrow(tr: number) {
    s.set('projThrowRatio', tr);
    let distIn = s.projDistance;
    if (s.projPin === 'width') {
      distIn = distanceFromWidth(s.projWidth, tr);
      s.set('projDistance', distIn);
    } else {
      s.set('projWidth', widthFromDistance(distIn, tr));
    }
    if (s.selectedProjectorId) {
      const p = s.projectors.find((x) => x.id === s.selectedProjectorId);
      const posIn: [number, number, number] = p
        ? [p.posIn[0], p.posIn[1], distIn]
        : [0, 90, distIn];
      s.updateProjector(s.selectedProjectorId, { throwRatio: tr, posIn });
    }
  }

  // Aspect ↔ resolution lock. When locked, editing the resolution rewrites the
  // aspect to its gcd-reduced ratio; editing the aspect keeps the pixel width and
  // recomputes the pixel height so the two never drift apart.
  function deriveAspectFromRes(w: number, h: number) {
    const g = gcd(w, h) || 1;
    s.set('projAspectW', Math.round(w / g));
    s.set('projAspectH', Math.round(h / g));
  }
  function setAspect(w: number, h: number) {
    s.set('projAspectW', w);
    s.set('projAspectH', h);
    if (s.projResLock && w > 0 && h > 0) {
      s.set('projResH', Math.round(s.projResW * (h / w)));
    }
  }
  function setResW(w: number) {
    s.set('projResW', w);
    if (s.projResLock && w > 0 && s.projResH > 0) deriveAspectFromRes(w, s.projResH);
    // resW feeds the selected projector's auto-focus band (withAutoFocus).
    if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { resW: w });
  }
  function setResH(h: number) {
    s.set('projResH', h);
    if (s.projResLock && h > 0 && s.projResW > 0) deriveAspectFromRes(s.projResW, h);
    if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { resH: h });
  }

  // Slider bounds in the active unit. Distance 1–60 ft; width 2–40 ft.
  const distMin = metric ? 30 : 12;
  const distMax = metric ? 1800 : 720;
  const widthMin = metric ? 60 : 24;
  const widthMax = metric ? 1200 : 480;
  const step = metric ? 5 : 2;

  // Manual entry for distance/width works in the user's big unit (ft or m), not
  // raw inches, so typing an exact size is natural.
  const bigUnit = metric ? 'm' : 'ft';
  const bigVal = (inches: number) =>
    metric ? Math.round(inches * 2.54) / 100 : Math.round((inches / 12) * 100) / 100;
  const bigToIn = (v: number) => (metric ? (v * 100) / 2.54 : v * 12);

  const distVal = round(fromInches(s.projDistance, units));
  const widthVal = round(fromInches(s.projWidth, units));
  const pinDistance = s.projPin === 'distance';
  const parametric = s.projGeometryMode === 'parametric';
  const freeform = !parametric;
  const sel = s.projectors.find((p) => p.id === s.selectedProjectorId);
  const vertShiftVal = freeform && sel ? sel.lensShiftPct : s.projLensShiftPct;
  const horizShiftVal = sel?.lensShiftXPct ?? 0;

  return (
    <>
      <div className="panel">
        <Row label="Show">
          <span className="seg sm">
            <button
              className={s.projSurfaceView === 'heatmap' ? 'on' : ''}
              onClick={() => s.set('projSurfaceView', 'heatmap')}
            >
              Heatmap
            </button>
            <button
              className={s.projSurfaceView === 'content' ? 'on' : ''}
              onClick={() => s.set('projSurfaceView', 'content')}
            >
              Content
            </button>
            <button
              className={s.projSurfaceView === 'focus' ? 'on' : ''}
              onClick={() => s.set('projSurfaceView', 'focus')}
            >
              Focus
            </button>
          </span>
        </Row>

        {s.projSurfaceView === 'content' && <ContentUpload />}
      </div>

      <Card title="Projector">

      <Row
        label="Geometry mode"
        title="Parametric: position/rotation are computed from throw distance, lens height, tilt, and array layout. Freeform: drag the 3D gizmo or type coordinates directly — the parametric fields stop writing to the transform."
      >
        <span className="seg sm">
          <button
            className={parametric ? 'on' : ''}
            onClick={() => s.set('projGeometryMode', 'parametric')}
          >
            Parametric
          </button>
          <button
            className={!parametric ? 'on' : ''}
            onClick={() => s.set('projGeometryMode', 'freeform')}
          >
            Freeform
          </button>
        </span>
      </Row>

      <Row label="Preset">
        <select
          value=""
          onChange={(e) => {
            const p = PRESETS[Number(e.target.value)];
            if (!p) return;
            s.set('projLumens', p.lumens);
            s.set('projResW', p.resW);
            s.set('projResH', p.resH);
            if (s.projResLock) deriveAspectFromRes(p.resW, p.resH);
            setThrow(p.throw);

            if (s.selectedProjectorId) {
              // Resolve the throw distance setThrow() above just applied, then
              // stamp resolution/lumens/focus in one update — bundling resW
              // with the focus band means auto-focus (if on) recomputes from
              // the new resolution, not whatever was on the instance before.
              const resultDistIn =
                s.projPin === 'width' ? distanceFromWidth(s.projWidth, p.throw) : s.projDistance;
              const { nearIn, farIn } = depthOfFocusIn(p.throw, resultDistIn, p.resW);
              s.updateProjector(s.selectedProjectorId, {
                resW: p.resW,
                resH: p.resH,
                lumens: p.lumens,
                focusNearIn: nearIn,
                focusFarIn: farIn,
              });
            }
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

      <Row label="Throw ratio">
        <input
          type="number"
          step={0.05}
          min={0.2}
          value={s.projThrowRatio}
          onChange={(e) => setThrow(Number(e.target.value))}
        />
      </Row>

      <Row label="Lumens (each)">
        <input
          type="number"
          step={250}
          min={100}
          value={s.projLumens}
          onChange={(e) => {
            const lm = Number(e.target.value);
            s.set('projLumens', lm);
            if (s.selectedProjectorId) {
              s.updateProjector(s.selectedProjectorId, { lumens: lm });
            }
          }}
        />
      </Row>

      <Row label="Stacked units">
        <span className="seg sm">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={s.projectorCount === n ? 'on' : ''}
              onClick={() => s.set('projectorCount', n)}
            >
              {n}×
            </button>
          ))}
        </span>
      </Row>

      {s.projectorCount > 1 && (
        <Row
          label="Stack efficiency"
          title="Lumens each added unit really contributes — real stacks lose ~10% to alignment, so 2× ≈ 1.9×, not 2×."
        >
          <span className="num-entry">
            <input
              type="number"
              step={1}
              min={0}
              max={100}
              value={Math.round(s.projStackEff * 100)}
              onChange={(e) =>
                s.set('projStackEff', Math.min(1, Math.max(0, Number(e.target.value) / 100)))
              }
            />
            <span className="unit">%</span>
          </span>
        </Row>
      )}

      {parametric && (
        <>
          <Row label="Blended array" title="Array layout is computed from projector count and overlap — switch to Freeform to place each unit by hand.">
            <span className="seg sm">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={s.projArrayCount === n ? 'on' : ''}
                  onClick={() => s.set('projArrayCount', n)}
                >
                  {n === 1 ? 'Off' : `${n}×`}
                </button>
              ))}
            </span>
          </Row>

          {s.projArrayCount > 1 && (
            <div
              className="field"
              title={`Projectors side by side, each overlapping its neighbour. Total width = ${s.projArrayCount}× one image minus the overlaps; the seams run ~2× bright until an edge-blend curve tapers them.`}
            >
              <div className="field-head">
                <span className="row-label">Overlap</span>
                <span className="num-readout">{s.projArrayOverlapPct}%</span>
              </div>
              <input
                className="slider"
                type="range"
                min={0}
                max={50}
                step={1}
                value={s.projArrayOverlapPct}
                onChange={(e) => s.set('projArrayOverlapPct', Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}

      <Row label="Aspect">
        <span className="aspect">
          <input
            type="number"
            min={1}
            value={s.projAspectW}
            onChange={(e) => setAspect(Number(e.target.value), s.projAspectH)}
          />
          <span>:</span>
          <input
            type="number"
            min={1}
            value={s.projAspectH}
            onChange={(e) => setAspect(s.projAspectW, Number(e.target.value))}
          />
        </span>
      </Row>

      <Row label="Resolution">
        <span className="res">
          <input
            type="number"
            min={1}
            value={s.projResW}
            onChange={(e) => setResW(Number(e.target.value))}
          />
          <span>×</span>
          <input
            type="number"
            min={1}
            value={s.projResH}
            onChange={(e) => setResH(Number(e.target.value))}
          />
        </span>
      </Row>

      <Row label="Link aspect ↔ res">
        <span className="seg sm">
          <button
            className={s.projResLock ? 'on' : ''}
            onClick={() => s.set('projResLock', true)}
          >
            Locked
          </button>
          <button
            className={!s.projResLock ? 'on' : ''}
            onClick={() => s.set('projResLock', false)}
          >
            Free
          </button>
        </span>
      </Row>
    </Card>

    <ProjectorListCard />

    <Card title="Geometry">

      {parametric && (
        <>
          <Row
            label="Drive by"
            title="Throw ratio links width and distance — pin one, the other follows."
          >
            <span className="seg sm">
              <button
                className={pinDistance ? 'on' : ''}
                onClick={() => s.set('projPin', 'distance')}
              >
                Distance
              </button>
              <button
                className={!pinDistance ? 'on' : ''}
                onClick={() => s.set('projPin', 'width')}
              >
                Width
              </button>
            </span>
          </Row>

          {pinDistance ? (
            <>
              <div className="field">
                <div className="field-head">
                  <span className="row-label">Throw distance</span>
                  <span className="num-entry">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={bigVal(s.projDistance)}
                      onChange={(e) => setDistance(bigToIn(Number(e.target.value)))}
                    />
                    <span className="unit">{bigUnit}</span>
                  </span>
                </div>
                <input
                  className="slider"
                  type="range"
                  min={distMin}
                  max={distMax}
                  step={step}
                  value={distVal}
                  onChange={(e) => setDistance(toInches(Number(e.target.value), units))}
                />
              </div>
              <Row label="Image width">
                <span className="num-readout">{fmtDist(s.projWidth, units)}</span>
              </Row>
            </>
          ) : (
            <>
              <div className="field">
                <div className="field-head">
                  <span className="row-label">Image width</span>
                  <span className="num-entry">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={bigVal(s.projWidth)}
                      onChange={(e) => setWidth(bigToIn(Number(e.target.value)))}
                    />
                    <span className="unit">{bigUnit}</span>
                  </span>
                </div>
                <input
                  className="slider"
                  type="range"
                  min={widthMin}
                  max={widthMax}
                  step={step}
                  value={widthVal}
                  onChange={(e) => setWidth(toInches(Number(e.target.value), units))}
                />
              </div>
              <Row label="Throw distance">
                <span className="num-readout">{fmtDist(s.projDistance, units)}</span>
              </Row>
            </>
          )}

          <div className="field">
            <div className="field-head">
              <span className="row-label">Lens height</span>
              <span className="num-readout">{fmtLen(s.projLensAff, units)}</span>
            </div>
            <input
              className="slider"
              type="range"
              min={0}
              max={metric ? 420 : 168}
              step={metric ? 2 : 1}
              value={round(fromInches(s.projLensAff, units))}
              onChange={(e) => {
                const aff = toInches(Number(e.target.value), units);
                s.set('projLensAff', aff);
                if (s.selectedProjectorId) {
                  const p = s.projectors.find((x) => x.id === s.selectedProjectorId);
                  if (p) s.updateProjector(p.id, { posIn: [p.posIn[0], aff, p.posIn[2]] });
                }
              }}
            />
          </div>
        </>
      )}

      <Row label="Lens origin">
        <span className="seg sm">
          <button
            className={s.projLensOrigin === 'center' ? 'on' : ''}
            onClick={() => {
              s.set('projLensOrigin', 'center');
              if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { lensOrigin: 'center' });
            }}
          >
            Centre
          </button>
          <button
            className={s.projLensOrigin === 'top' ? 'on' : ''}
            onClick={() => {
              s.set('projLensOrigin', 'top');
              if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { lensOrigin: 'top' });
            }}
          >
            Top
          </button>
        </span>
      </Row>

      <div
        className="field"
        title={
          freeform
            ? 'Optical shift — moves this projector\'s image up (+) or down (−) with no keystone. 0% sits at the lens origin above.'
            : 'Optical shift — moves the image up (+) or down (−) with no keystone. 0% sits at the lens origin above.'
        }
      >
        <div className="field-head">
          <span className="row-label">Vertical lens shift</span>
          <span className="num-readout">{vertShiftVal > 0 ? '+' : ''}{vertShiftVal}%</span>
        </div>
        <input
          className="slider"
          type="range"
          min={-130}
          max={130}
          step={5}
          value={vertShiftVal}
          onChange={(e) => {
            const val = Number(e.target.value);
            // In Freeform, per-projector shift only — writing the global field
            // here would recompute the nominal frustum and yank the camera to
            // re-centre on it while the user is nudging one unit.
            if (!freeform) s.set('projLensShiftPct', val);
            if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { lensShiftPct: val });
          }}
        />
      </div>

      {freeform && sel && (
        <div
          className="field"
          title="Optical shift — moves this projector's image left (−) or right (+) with no keystone. 0% is centred on the lens axis."
        >
          <div className="field-head">
            <span className="row-label">Horizontal lens shift</span>
            <span className="num-readout">{horizShiftVal > 0 ? '+' : ''}{horizShiftVal}%</span>
          </div>
          <input
            className="slider"
            type="range"
            min={-130}
            max={130}
            step={5}
            value={horizShiftVal}
            onChange={(e) => s.updateProjector(sel.id, { lensShiftXPct: Number(e.target.value) })}
          />
        </div>
      )}

      {parametric && (
        <div
          className="field"
          title="Physically tilting the projector — this is what bends the image into a keystone."
        >
          <div className="field-head">
            <span className="row-label">Tilt</span>
            <span className="num-readout">{s.projTiltDeg}°</span>
          </div>
          <input
            className="slider"
            type="range"
            min={-30}
            max={30}
            step={1}
            value={s.projTiltDeg}
            onChange={(e) => {
              const val = Number(e.target.value);
              s.set('projTiltDeg', val);
              if (s.selectedProjectorId) {
                const p = s.projectors.find((x) => x.id === s.selectedProjectorId);
                if (p) s.updateProjector(p.id, { rotDeg: [val, p.rotDeg[1], p.rotDeg[2]] });
              }
            }}
          />
        </div>
      )}
    </Card>

    <Card title="Environment">

      <div
        className="field"
        title="Foot-candles of competing room light. The image needs to out-shine it."
      >
        <div className="field-head">
          <span className="row-label">Ambient light</span>
          <span className="num-readout">{s.projAmbientFc} fc</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={s.projAmbientFc}
          onChange={(e) => s.set('projAmbientFc', Number(e.target.value))}
        />
      </div>
    </Card>

    <Card title="Surface">

      <Row label="Canvas">
        <span className="seg sm">
          <button
            className={s.projCanvasType === 'wall' ? 'on' : ''}
            onClick={() => s.set('projCanvasType', 'wall')}
          >
            Wall
          </button>
          <button
            className={s.projCanvasType === 'curved' ? 'on' : ''}
            onClick={() => s.set('projCanvasType', 'curved')}
          >
            Curved
          </button>
          <button
            className={s.projCanvasType === 'cylinder' ? 'on' : ''}
            onClick={() => s.set('projCanvasType', 'cylinder')}
          >
            Column
          </button>
          <button
            className={s.projCanvasType === 'model' ? 'on' : ''}
            onClick={() => s.set('projCanvasType', 'model')}
          >
            3D Model
          </button>
        </span>
      </Row>

      {s.projCanvasType === 'model' && <ModelControls />}

      {s.projCanvasType === 'curved' && (
        <>
          <Row label="Curvature">
            <span className="seg sm">
              <button
                className={s.projCurvedRadius >= 0 ? 'on' : ''}
                onClick={() => s.set('projCurvedRadius', Math.abs(s.projCurvedRadius) || 144)}
              >
                Concave
              </button>
              <button
                className={s.projCurvedRadius < 0 ? 'on' : ''}
                onClick={() => s.set('projCurvedRadius', -(Math.abs(s.projCurvedRadius) || 144))}
              >
                Convex
              </button>
            </span>
          </Row>

          <div className="field">
            <div className="field-head">
              <span className="row-label">Curve radius</span>
              <span className="num-readout">
                {fmtDist(Math.abs(s.projCurvedRadius), units)}{' '}
                <span style={{ opacity: 0.65 }}>({s.projCurvedRadius < 0 ? 'Convex' : 'Concave'})</span>
              </span>
            </div>
            <input
              className="slider"
              type="range"
              min={metric ? 150 : 60}
              max={metric ? 1200 : 480}
              step={metric ? 10 : 6}
              value={round(fromInches(Math.abs(s.projCurvedRadius), units))}
              onChange={(e) => {
                const sign = s.projCurvedRadius < 0 ? -1 : 1;
                s.set('projCurvedRadius', sign * toInches(Number(e.target.value), units));
              }}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <span className="row-label">Arc span</span>
              <span className="num-readout">{s.projCurvedArcDeg}°</span>
            </div>
            <input
              className="slider"
              type="range"
              min={20}
              max={180}
              step={5}
              value={s.projCurvedArcDeg}
              onChange={(e) => s.set('projCurvedArcDeg', Number(e.target.value))}
            />
          </div>

          <div className="field">
            <div className="field-head">
              <span className="row-label">Screen height</span>
              <span className="num-readout">{fmtDist(s.projCanvasHeight, units)}</span>
            </div>
            <input
              className="slider"
              type="range"
              min={metric ? 150 : 60}
              max={metric ? 600 : 240}
              step={metric ? 10 : 6}
              value={round(fromInches(s.projCanvasHeight, units))}
              onChange={(e) => s.set('projCanvasHeight', toInches(Number(e.target.value), units))}
            />
          </div>
        </>
      )}

      <Row
        label="Screen gain"
        title="Luminance (foot-Lamberts) = brightness (fc) × gain. 1.0 = matte white."
      >
        <span className="num-entry">
          <input
            type="number"
            step={0.1}
            min={0.1}
            value={s.projScreenGain}
            onChange={(e) => s.set('projScreenGain', Math.max(0.1, Number(e.target.value)))}
          />
          <span className="unit">×</span>
        </span>
      </Row>

      <label className="check">
        <input
          type="checkbox"
          checked={s.projShowFigure}
          onChange={(e) => s.set('projShowFigure', e.target.checked)}
        />
        Show person for scale
      </label>
    </Card>
  </>
);
}
