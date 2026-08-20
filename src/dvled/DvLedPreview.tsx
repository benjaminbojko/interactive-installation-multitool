import { useCallback, useEffect, useMemo, useState } from 'react';
import { PERSONAS } from '../ergonomics/constants';
import { makeTestPatternCanvas } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import { fmtDist } from '../ui/units';
import { CabinetOverlay } from './CabinetOverlay';
import { ledBuild } from './cabinets';
import { DvLedCanvas } from './DvLedCanvas';
import { ScaleOverlay } from './ScaleOverlay';
import { dvledMetrics, mToIn, pitchFillFraction, type Perceived } from './optics';

/** Human-friendly height label, e.g. 5'9" or 175 cm. */
function fmtHeight(inches: number, metric: boolean): string {
  if (metric) return `${Math.round(inches * 2.54)} cm`;
  const ft = Math.floor(inches / 12);
  const inch = Math.round(inches - ft * 12);
  return `${ft}'${inch}"`;
}

const PERCEIVED_LABEL: Record<Perceived, { text: string; tone: string }> = {
  pixelated: { text: 'Pixels clearly visible', tone: 'bad' },
  soft: { text: 'Pixels faintly visible', tone: 'caution' },
  clean: { text: 'Looks clean', tone: 'good' },
  retina: { text: 'Pixel-perfect (retina)', tone: 'good' },
};

/** A featureless mid-grey panel, so "cabinets" view still renders through the
 *  LED shader — you see the real pitch and fill texture, just no picture. */
function makeBlankCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, 2, 2);
  return c;
}

export function DvLedPreview() {
  const units = useConfigStore((s) => s.units);
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
  const dvledScalePersona = useConfigStore((s) => s.dvledScalePersona);
  const contentUrl = useConfigStore((s) => s.contentUrl);

  // The wall you could actually build: cabinet counts rounded up, whole pixels
  // per cabinet, and the true pitch that implies. Everything downstream —
  // shader, optics, readout — reads the BUILT numbers, not the typed ones.
  const build = useMemo(
    () =>
      ledBuild({
        sizeMode: ledSizeMode,
        diagonal: ledDiagonal,
        aspectW: ledAspectW,
        aspectH: ledAspectH,
        cabinetW: ledCabinetW,
        cabinetH: ledCabinetH,
        cols: ledCabCols,
        rows: ledCabRows,
        pitchMm: ledPitchMm,
      }),
    [ledSizeMode, ledDiagonal, ledAspectW, ledAspectH, ledCabinetW, ledCabinetH, ledCabCols, ledCabRows, ledPitchMm],
  );

  const m = useMemo(
    () => dvledMetrics(build.builtWidthIn, build.builtHeightIn, build.pitchMm, dvledDistance, dvledFov),
    [build.builtWidthIn, build.builtHeightIn, build.pitchMm, dvledDistance, dvledFov],
  );

  // Content source: bare cabinets, an uploaded image, or the test pattern.
  const [source, setSource] = useState<TexImageSource | null>(null);
  useEffect(() => {
    if (ledView === 'cabinets') {
      setSource(makeBlankCanvas());
      return;
    }
    if (contentUrl) {
      const img = new Image();
      img.onload = () => setSource(img);
      img.src = contentUrl;
      return;
    }
    // Aspect comes from the built pixel grid, and the label from the built
    // diagonal — the pattern should describe the wall you'd get, not the target.
    setSource(
      makeTestPatternCanvas(
        build.totalPxX,
        build.totalPxY,
        Math.hypot(build.builtWidthIn, build.builtHeightIn),
      ),
    );
  }, [ledView, contentUrl, build.totalPxX, build.totalPxY, build.builtWidthIn, build.builtHeightIn]);

  const tone = PERCEIVED_LABEL[m.perceived];

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const onCanvasResize = useCallback((w: number, h: number) => {
    setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  const persona = PERSONAS[dvledScalePersona];
  const effectiveFill = dvledLockFill ? pitchFillFraction(build.pitchMm) : fillFactor;
  const pitchDrifted = Math.abs(build.pitchMm - build.nominalPitchMm) > 0.005;

  return (
    <div className="dvled-stage">
      <div className="dvled-frame">
        <DvLedCanvas
          source={source}
          cols={build.totalPxX}
          rows={build.totalPxY}
          wallFillFraction={m.wallFillFraction}
          fillFactor={effectiveFill}
          shape={ledShape}
          aspect={build.builtWidthIn / build.builtHeightIn}
          onResize={onCanvasResize}
        />
        {canvasSize.w > 0 && ledView === 'cabinets' && (
          <div className="dvled-overlay" style={{ width: canvasSize.w, height: canvasSize.h }}>
            <CabinetOverlay
              cssW={canvasSize.w}
              cssH={canvasSize.h}
              wallFillFraction={m.wallFillFraction}
              cols={build.cols}
              rows={build.rows}
            />
          </div>
        )}
        {dvledShowScale && canvasSize.w > 0 && (
          <div className="dvled-overlay" style={{ width: canvasSize.w, height: canvasSize.h }}>
            <ScaleOverlay
              cssW={canvasSize.w}
              cssH={canvasSize.h}
              viewSpanWidthIn={m.viewSpanWidthIn}
              wallFillFraction={m.wallFillFraction}
              statureIn={persona.statureHeight}
              eyeHeightIn={persona.eyeHeight}
              figureLabel={fmtHeight(persona.statureHeight, units === 'metric')}
              seated={persona.seated}
              metric={units === 'metric'}
            />
          </div>
        )}
      </div>

      <div className="dvled-readout">
        <div className={`dvled-verdict ${tone.tone}`}>
          <span className="dvled-dot" />
          {tone.text}
          <span className="dvled-sub">at {fmtDist(dvledDistance, units)}</span>
        </div>
        <dl className="dvled-metrics">
          <div>
            <dt>Wall size (W × H)</dt>
            <dd>
              {fmtDist(build.builtWidthIn, units)} × {fmtDist(build.builtHeightIn, units)}
            </dd>
          </div>
          <div>
            <dt>Cabinet grid</dt>
            <dd>
              {build.cols} × {build.rows}
              <span className="dvled-metric-sub"> = {build.totalCabinets}</span>
            </dd>
          </div>
          <div>
            <dt>Cabinet</dt>
            <dd>
              {ledCabinetW} × {ledCabinetH} <span className="dvled-metric-sub">mm</span>
            </dd>
          </div>
          <div>
            <dt>Resolution per cabinet</dt>
            <dd>
              {build.pxPerCabX} × {build.pxPerCabY} <span className="dvled-metric-sub">px</span>
            </dd>
          </div>
          <div>
            <dt>Total resolution</dt>
            <dd>
              {build.totalPxX.toLocaleString()} × {build.totalPxY.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Pixel pitch</dt>
            <dd>
              P{build.pitchMm.toFixed(3)}
              {pitchDrifted && <span className="dvled-metric-sub"> (nom. {build.nominalPitchMm})</span>}
            </dd>
          </div>
          <div>
            <dt>Sharpness</dt>
            <dd>{m.ppd === Infinity ? '∞' : Math.round(m.ppd)} px/°</dd>
          </div>
          <div>
            <dt>Clean from</dt>
            <dd>{fmtDist(mToIn(m.minCleanDistanceM), units)}</dd>
          </div>
          <div>
            <dt>Pixel-free from</dt>
            <dd>{fmtDist(mToIn(m.retinaDistanceM), units)}</dd>
          </div>
        </dl>
        <p className="dvled-note">
          {m.fillsFrame
            ? `You're inside the wall — this frame shows ~${Math.round(
                m.cellsAcrossView,
              ).toLocaleString()} of its ${build.totalPxX.toLocaleString()} columns across a ${dvledFov}° gaze.`
            : `The whole wall now sits inside your ${dvledFov}° field of view.`}{' '}
          You're at {fmtDist(dvledDistance, units)}; it reads clean from{' '}
          {fmtDist(mToIn(m.minCleanDistanceM), units)} back.
        </p>
      </div>
    </div>
  );
}
