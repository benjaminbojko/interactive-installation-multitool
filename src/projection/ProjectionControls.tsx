import { useConfigStore } from '../store/useConfigStore';
import { ContentUpload } from '../ui/ContentUpload';
import { ModelControls } from '../ui/ModelControls';
import { ProjectorListCard } from './ProjectorListCard';
import { Card } from '../ui/Card';
import { fmtDist, fmtLen, fromInches, toInches } from '../ui/units';
import { distanceFromWidth, widthFromDistance } from './projectionMath';

// Projector / lens presets — throw ratios pinned to real Barco lenses (full
// catalog, barco.json: 236 projector bodies / 2111 lens entries), one
// representative throw value per lens's published min–max zoom range, cross-
// checked against active (non-EOL) listings only. focusNear/FarPct are % of
// the resulting throw distance — no projector or lens in the catalog has a
// depth-of-focus field, so these stay reasoned estimates: shorter lenses sit
// at a steeper angle of incidence, so the same physical distance error eats a
// bigger fraction of the (short) throw, hence a tighter band; long-throw
// lenses tolerate more.
const PRESETS: {
  label: string;
  throw: number;
  lumens: number;
  resW: number;
  resH: number;
  focusNearPct: number;
  focusFarPct: number;
}[] = [
  // ILD 0.37 UST, R9803077 — the most common Barco-branded UST throw ratio
  // (0.37:1 also appears on GLD 0.37-0.40 UST 90°/F80 and G LENS 0.37-0.4:1
  // UST/G-series). The catalog's single shortest lens, FLD+ 0.26:1 (EN68,
  // F400-N4K), isn't actually Barco-branded "UST" — it's an outlier, not
  // representative.
  { label: 'Ultra-short-throw, 1080p — 0.37 / 4k lm', throw: 0.37, lumens: 4000, resW: 1920, resH: 1080, focusNearPct: 96, focusFarPct: 104 },
  // GLD 0.8-1.0:1, R98017241, F80-4K7 (throw 0.80–1.06)
  { label: 'Short-throw, 1080p — 0.9 / 4k lm', throw: 0.9, lumens: 4000, resW: 1920, resH: 1080, focusNearPct: 92, focusFarPct: 108 },
  // GLD 1.0-1.35:1, R98017221, F80-4K7 (throw 1.00–1.43)
  { label: 'Install 4K — 1.2 / 10k lm', throw: 1.2, lumens: 10000, resW: 3840, resH: 2160, focusNearPct: 88, focusFarPct: 114 },
  // GLD 1.35-2.0:1, R98017201, F80-4K7 (throw 1.35–2.12)
  { label: 'Standard, 1080p — 1.5 / 5k lm', throw: 1.5, lumens: 5000, resW: 1920, resH: 1080, focusNearPct: 85, focusFarPct: 118 },
  // GLD 2.0-3.0:1, R98017211, F80-4K7 (throw 2.00–3.18)
  { label: 'Long-throw event — 2.5 / 20k lm', throw: 2.5, lumens: 20000, resW: 1920, resH: 1200, focusNearPct: 80, focusFarPct: 130 },
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
  // throw ratio) recomputes the other so the store never drifts.
  function setDistance(distIn: number) {
    s.set('projDistance', distIn);
    s.set('projWidth', widthFromDistance(distIn, s.projThrowRatio));
    if (s.selectedProjectorId) {
      const p = s.projectors.find((x) => x.id === s.selectedProjectorId);
      if (p) s.updateProjector(p.id, { posIn: [p.posIn[0], p.posIn[1], distIn] });
    }
  }
  function setWidth(widthIn: number) {
    s.set('projWidth', widthIn);
    s.set('projDistance', distanceFromWidth(widthIn, s.projThrowRatio));
  }
  function setThrow(tr: number) {
    s.set('projThrowRatio', tr);
    if (s.projPin === 'width') {
      s.set('projDistance', distanceFromWidth(s.projWidth, tr));
    } else {
      s.set('projWidth', widthFromDistance(s.projDistance, tr));
    }
    if (s.selectedProjectorId) {
      s.updateProjector(s.selectedProjectorId, { throwRatio: tr });
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
  }
  function setResH(h: number) {
    s.set('projResH', h);
    if (s.projResLock && h > 0 && s.projResW > 0) deriveAspectFromRes(s.projResW, h);
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

  return (
    <>
      <Card title="Projector">

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

            // Resolve the throw distance setThrow() above just applied, then
            // stamp the preset's focus tolerance onto it as absolute inches.
            const resultDistIn =
              s.projPin === 'width' ? distanceFromWidth(s.projWidth, p.throw) : s.projDistance;
            const nearIn = resultDistIn * (p.focusNearPct / 100);
            const farIn = resultDistIn * (p.focusFarPct / 100);
            s.set('projFocusNearIn', nearIn);
            s.set('projFocusFarIn', farIn);
            if (s.selectedProjectorId) {
              s.updateProjector(s.selectedProjectorId, { focusNearIn: nearIn, focusFarIn: farIn });
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

      <Row label="Blended array">
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
        title="Optical shift — moves the image up (+) or down (−) with no keystone. 0% sits at the lens origin above."
      >
        <div className="field-head">
          <span className="row-label">Vertical lens shift</span>
          <span className="num-readout">{s.projLensShiftPct > 0 ? '+' : ''}{s.projLensShiftPct}%</span>
        </div>
        <input
          className="slider"
          type="range"
          min={-130}
          max={130}
          step={5}
          value={s.projLensShiftPct}
          onChange={(e) => {
            const val = Number(e.target.value);
            s.set('projLensShiftPct', val);
            if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { lensShiftPct: val });
          }}
        />
      </div>

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
    </Card>

    <Card title="Focus">

      <Row
        label="Focus at throw distance"
        title="One-click default: centre the acceptably-sharp band on the current throw distance, ±15%/+25% (near limits hold tighter than far limits on a real lens)."
      >
        <button
          className="sm"
          onClick={() => {
            const near = s.projDistance * 0.85;
            const far = s.projDistance * 1.25;
            s.set('projFocusNearIn', near);
            s.set('projFocusFarIn', far);
            if (s.selectedProjectorId) {
              s.updateProjector(s.selectedProjectorId, { focusNearIn: near, focusFarIn: far });
            }
          }}
        >
          Apply
        </button>
      </Row>

      <Row
        label="Near limit"
        title="Nearest distance from the lens that still reads as acceptably sharp."
      >
        <span className="num-entry">
          <input
            type="number"
            step={0.1}
            min={0}
            value={bigVal(s.projFocusNearIn)}
            onChange={(e) => {
              const val = bigToIn(Number(e.target.value));
              s.set('projFocusNearIn', val);
              if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { focusNearIn: val });
            }}
          />
          <span className="unit">{bigUnit}</span>
        </span>
      </Row>

      <Row
        label="Far limit"
        title="Farthest distance from the lens that still reads as acceptably sharp."
      >
        <span className="num-entry">
          <input
            type="number"
            step={0.1}
            min={0}
            value={bigVal(s.projFocusFarIn)}
            onChange={(e) => {
              const val = bigToIn(Number(e.target.value));
              s.set('projFocusFarIn', val);
              if (s.selectedProjectorId) s.updateProjector(s.selectedProjectorId, { focusFarIn: val });
            }}
          />
          <span className="unit">{bigUnit}</span>
        </span>
      </Row>
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
