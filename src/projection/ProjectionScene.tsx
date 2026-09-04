import { Canvas } from '@react-three/fiber';
import { Grid, Line, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { f } from '../scene/scale';
import { makeWallGrid } from '../scene/wallGrid';
import { useFrameloop } from '../scene/useFrameloop';
import { ProjectionFigure } from './ProjectionFigure';
import { ProjectorNode } from './ProjectorNode';
import { ProjectionCanvasMesh } from './ProjectionCanvasMesh';
import { buildProjectorSpecsFromInstances } from './projectiveOptics';
import {
  arrayLayout,
  BAND_LABEL,
  BAND_TONE,
  fcToColor,
  focusGradientCss,
  frustumGeometry,
  ftFromIn,
  projectionArrayMetrics,
  projectionMetrics,
  rampGradientCss,
  inFromFt,
  FC_MIN_ACCEPTABLE,
  FC_DESIRABLE,
} from './projectionMath';

const WALL_HEIGHT = 16; // ft

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#aab2bd', 1.5]} />
      <directionalLight position={[6, 14, 9]} intensity={1.2} />
      <directionalLight position={[-8, 8, 6]} intensity={0.5} />
    </>
  );
}

function Floor() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#b9c0c9" />
      </mesh>
      <Grid
        args={[80, 80]}
        cellSize={1}
        cellColor="#9aa3ae"
        sectionSize={5}
        sectionColor="#6f7a87"
        infiniteGrid
        fadeDistance={70}
        position={[0, 0.002, 10]}
      />
    </>
  );
}

function Wall({ width }: { width: number }) {
  const w = Math.max(f(width) + 8, 18);
  const grid = useMemo(() => makeWallGrid(), []);
  useEffect(() => () => grid.dispose(), [grid]);
  grid.repeat.set(Math.round(w), WALL_HEIGHT);

  return (
    <group>
      <mesh position={[0, WALL_HEIGHT / 2, -0.02]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshStandardMaterial color="#8d96a2" />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, -0.008]}>
        <planeGeometry args={[w, WALL_HEIGHT]} />
        <meshBasicMaterial map={grid} transparent />
      </mesh>
    </group>
  );
}

const LINE = '#10202e';

export function ProjectionScene() {
  const s = useConfigStore();
  const units = s.units;
  const orbitRef = useRef<any>(null);
  const frameloop = useFrameloop();

  const metrics = useMemo(
    () =>
      projectionMetrics({
        throwRatio: s.projThrowRatio,
        distanceIn: s.projDistance,
        aspectW: s.projAspectW,
        aspectH: s.projAspectH,
        lumens: s.projLumens,
        projectorCount: s.projectorCount,
        stackEff: s.projStackEff,
        resW: s.projResW,
        resH: s.projResH,
        ambientFc: s.projAmbientFc,
        screenGain: s.projScreenGain,
      }),
    [
      s.projThrowRatio,
      s.projDistance,
      s.projAspectW,
      s.projAspectH,
      s.projLumens,
      s.projectorCount,
      s.projStackEff,
      s.projResW,
      s.projResH,
      s.projAmbientFc,
      s.projScreenGain,
    ],
  );

  const geom = useMemo(
    () =>
      frustumGeometry({
        distanceIn: s.projDistance,
        throwRatio: s.projThrowRatio,
        aspectW: s.projAspectW,
        aspectH: s.projAspectH,
        lensAffIn: s.projLensAff,
        lensShiftPct: s.projLensShiftPct,
        lensOrigin: s.projLensOrigin,
        tiltDeg: s.projTiltDeg,
      }),
    [
      s.projDistance,
      s.projThrowRatio,
      s.projAspectW,
      s.projAspectH,
      s.projLensAff,
      s.projLensShiftPct,
      s.projLensOrigin,
      s.projTiltDeg,
    ],
  );

  // Horizontal edge-blended array: lay the single image out N times with a
  // uniform neighbour overlap, then slide a copy of the frustum to each centre.
  const layout = useMemo(
    () => arrayLayout(s.projArrayCount, s.projArrayOverlapPct, metrics.widthFt),
    [s.projArrayCount, s.projArrayOverlapPct, metrics.widthFt],
  );
  const arrayM = useMemo(
    () => projectionArrayMetrics(metrics, layout, s.projResW),
    [metrics, layout, s.projResW],
  );
  // Content slice each projector covers, as a fraction of the spanning image.
  const uRanges = useMemo(() => {
    const active = s.projectors.filter((p) => p.enabled);
    if (active.length <= 1) return [[0, 1] as [number, number]];
    const xs = active.map((p) => p.posIn[0] / 12);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = Math.max(0.1, maxX - minX + metrics.widthFt);
    return active.map((p): [number, number] => {
      const cx = p.posIn[0] / 12;
      const left = Math.max(0, (cx - metrics.widthFt / 2 - minX) / span);
      const right = Math.min(1, (cx + metrics.widthFt / 2 - minX) / span);
      return [left, right];
    });
  }, [s.projectors, metrics.widthFt]);
  const isArray = s.projectors.filter((p) => p.enabled).length > 1;

  // Freeform mode places/aims each projector by hand — there's no single
  // shared throw distance or canvas rectangle to measure a width/height
  // from (and a naive bounding box blows up whenever a unit is aimed
  // near-parallel to the wall). So width/height/brightness stay the
  // parametric single-projector numbers, and the UI hides the readouts
  // that would otherwise misrepresent a freeform setup as one flat image.
  const freeform = s.projGeometryMode === 'freeform';

  const specs = useMemo(
    () => buildProjectorSpecsFromInstances(s.projectors, uRanges),
    [s.projectors, uRanges],
  );

  const widthFt = isArray ? arrayM.totalWidthFt : metrics.widthFt;
  const heightFt = metrics.heightFt;
  const areaSqFt = isArray ? arrayM.totalAreaSqFt : metrics.areaSqFt;
  const footCandles = metrics.footCandles;
  const footLamberts = metrics.footLamberts;
  const nits = metrics.nits;
  const contrastRatio = metrics.contrastRatio;
  const band = metrics.band;
  const count = arrayM.count;
  const hPpf = isArray ? arrayM.hPpf : metrics.hPpf;
  const vPpf = metrics.vPpf;
  const distFt = ftFromIn(s.projDistance);
  // Total lumens on tap doesn't need a shared canvas — just sum whatever's
  // enabled — so it stays meaningful (and freeform-aware) even when the
  // rest of the readout is hidden.
  const systemLumens = freeform
    ? s.projectors.filter((p) => p.enabled).reduce((sum, p) => sum + p.lumens, 0)
    : isArray
      ? arrayM.systemLumens
      : metrics.effectiveLumens;

  const tone = BAND_TONE[band];
  const imgCenterY = geom.imageCenterFt;
  const halfW = widthFt / 2;
  const imageHeightFt = heightFt;
  const bandColor = fcToColor(footCandles);

  // Camera framing scaled to the setup (full array width).
  const camX = -(Math.max(8, widthFt) + 4);
  const camY = Math.max(7, imgCenterY + 4);
  const camZ = distFt + 8;

  const bottomY = geom.bottomLeft[1];

  return (
    <div className="proj-stage">
      <div className="proj-frame">
        <Canvas
          dpr={[1, 2]}
          frameloop={frameloop}
          onPointerMissed={() => s.selectProjector(null)}
          style={{
            background: 'linear-gradient(180deg,#dfe4ea 0%,#bcc4ce 55%,#9ca5b0 100%)',
          }}
        >
          <PerspectiveCamera makeDefault fov={45} position={[camX, camY, camZ]} />
          <OrbitControls
            ref={orbitRef}
            target={[0, Math.max(3, imgCenterY), distFt * 0.4]}
            maxPolarAngle={Math.PI / 2}
          />
          <Lights />
          <Floor />
          {s.projCanvasType === 'wall' && <Wall width={inFromFt(widthFt)} />}
          <ProjectionCanvasMesh
            canvasType={s.projCanvasType}
            specs={specs}
            nominalFc={footCandles}
            distFt={distFt}
            overlapFrac={layout.overlapFrac}
            wallWidthFt={widthFt}
            wallHeightFt={heightFt}
            centerY={imgCenterY}
            curvedRadiusFt={ftFromIn(s.projCurvedRadius)}
            curvedArcDeg={s.projCurvedArcDeg}
          />
          {s.projectors
            .filter((p) => p.enabled)
            .map((p) => (
              <ProjectorNode
                key={p.id}
                projector={p}
                isSelected={p.id === s.selectedProjectorId}
                bandColor={bandColor}
                gizmoMode={s.transformGizmoMode}
                gizmoSpace={s.transformGizmoSpace}
                gizmoEnabled={s.projGeometryMode === 'freeform'}
                isMetric={units === 'metric'}
                onSelect={() => s.selectProjector(p.id)}
                onTransformEnd={(posIn, rotDeg) => s.updateProjector(p.id, { posIn, rotDeg })}
                orbitRef={orbitRef}
              />
            ))}
          {/* Blend seams: the overlap of two projectors runs ~2× bright before
              the blend curve tapers it — flag each seam as a hot strip.
              Parametric-only: freeform placement has no uniform-overlap seam. */}
          {!freeform &&
            isArray &&
            s.projSurfaceView === 'heatmap' &&
            layout.seamsX.map((sx, i) => (
              <mesh key={i} position={[sx, imgCenterY, 0.03]}>
                <planeGeometry args={[layout.overlapWidthFt, imageHeightFt]} />
                <meshBasicMaterial
                  color="#ffe08a"
                  transparent
                  opacity={0.3}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ))}
          {s.projShowFigure && <ProjectionFigure pos={[halfW + 1.5, 2]} />}

          {/* Width/throw dimension readout: a parametric concept (one shared
              canvas, one throw distance) that freeform placement doesn't
              have — hide it there rather than measure something undefined. */}
          {!freeform && (
            <>
              <Line
                points={[
                  [-halfW, bottomY - 0.5, 0.02],
                  [halfW, bottomY - 0.5, 0.02],
                ]}
                color={LINE}
                lineWidth={2}
              />
              <Text
                position={[0, bottomY - 1.1, 0.06]}
                fontSize={0.5}
                color={LINE}
                outlineWidth={0.02}
                outlineColor="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                {fmtDist(inFromFt(widthFt), units)} wide
                {isArray ? ` · ${count}×` : ''} · {Math.round(footCandles)} fc ·{' '}
                {Math.round(footLamberts)} fL
              </Text>

              <Line
                points={[
                  [halfW + 1.5, 0.02, 0],
                  [halfW + 1.5, 0.02, distFt],
                ]}
                color={LINE}
                lineWidth={2}
              />
              <Text
                position={[halfW + 2.1, 0.03, distFt / 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.5}
                color={LINE}
                outlineWidth={0.02}
                outlineColor="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                {fmtDist(inFromFt(distFt), units)} throw
              </Text>
            </>
          )}
        </Canvas>
      </div>

      <div className="proj-readout">
        <div className="proj-top">
          {freeform ? (
            <div className="dvled-verdict">
              Freeform: each projector has its own position, aim, and throw —
              no single shared canvas to size or measure.
            </div>
          ) : (
            <div className={`dvled-verdict ${tone}`}>
              <span className="dvled-dot" />
              {BAND_LABEL[band]}
              <span className="dvled-sub">
                {Math.round(footCandles)} fc on a {widthFt.toFixed(1)} ×{' '}
                {heightFt.toFixed(1)} ft image
              </span>
            </div>
          )}
          {s.projSurfaceView === 'focus' ? (
            <div className="proj-legend">
              <div className="proj-legend-bar" style={{ background: focusGradientCss() }} />
              <div className="proj-legend-ticks">
                <span>Blurred</span>
                <span>Sharp</span>
                <span>Blurred</span>
              </div>
              <div className="proj-legend-caption">
                Focus band {fmtDist(s.projFocusNearIn, units)}
                {'–'}
                {fmtDist(s.projFocusFarIn, units)}, sharpest around{' '}
                {fmtDist((s.projFocusNearIn + s.projFocusFarIn) / 2, units)}
              </div>
            </div>
          ) : (
            <div className="proj-legend">
              <div className="proj-legend-bar" style={{ background: rampGradientCss() }} />
              <div className="proj-legend-ticks">
                <span>0</span>
                <span>{FC_MIN_ACCEPTABLE}</span>
                <span>100</span>
                <span>{FC_DESIRABLE}</span>
                <span>800</span>
              </div>
              <div className="proj-legend-caption">
                Surface brightness {'—'} foot-candles (dim {'→'} bright)
              </div>
            </div>
          )}
        </div>

        <dl className="dvled-metrics">
          {!freeform && (
            <>
              <div>
                <dt>Image size</dt>
                <dd>
                  {widthFt.toFixed(1)} × {heightFt.toFixed(1)} ft
                </dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{Math.round(areaSqFt)} ft²</dd>
              </div>
              {isArray && (
                <div>
                  <dt>Array</dt>
                  <dd>
                    {count} wide · {Math.round(s.projArrayOverlapPct)}% overlap
                  </dd>
                </div>
              )}
              {isArray && (
                <div>
                  <dt>Combined res</dt>
                  <dd>
                    {arrayM.combinedResW.toLocaleString()} × {s.projResH.toLocaleString()} px
                  </dd>
                </div>
              )}
              <div>
                <dt>Brightness</dt>
                <dd>
                  {Math.round(footCandles)} fc
                  {isArray ? ` · seams ${Math.round(arrayM.blendFc)}` : ''}
                </dd>
              </div>
              <div>
                <dt>Luminance</dt>
                <dd>
                  {Math.round(footLamberts)} fL · {Math.round(nits)} nits
                </dd>
              </div>
              <div>
                <dt>Ambient contrast</dt>
                <dd>{contrastRatio === Infinity ? '∞' : `${contrastRatio.toFixed(1)}:1`}</dd>
              </div>
              <div>
                <dt>Resolution / ft</dt>
                <dd>
                  {Math.round(hPpf)} × {Math.round(vPpf)} px
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Total output</dt>
            <dd>{Math.round(systemLumens).toLocaleString()} lm</dd>
          </div>
        </dl>
        <p className="dvled-note">
          {freeform ? (
            'Freeform: width, height, and brightness need one shared canvas, which per-projector placement doesn’t have — only total lumens is shown. Switch to Parametric for the sized readout.'
          ) : (
            <>
              Throw ratio {s.projThrowRatio} ·{' '}
              {s.projectorCount > 1
                ? `${s.projectorCount} stacked @ ${Math.round(s.projStackEff * 100)}% (${(metrics.effectiveLumens / s.projLumens).toFixed(1)}× lumens) · `
                : ''}
              {isArray
                ? `${arrayM.count} blended across ${arrayM.totalWidthFt.toFixed(1)} ft at ${Math.round(s.projArrayOverlapPct)}% overlap — seams run ~2× bright before the blend curve evens them out. `
                : ''}
              brightness is the area-average; lens shift keeps a clean rectangle while tilt
              keystones it and brightens the near edge. 20 fc is the floor, 400+ is comfortably bright.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
