// UI control for uploading custom 3D models (.glb, .gltf) and adjusting transform.

import { useRef } from 'react';
import { useConfigStore, type Units } from '../store/useConfigStore';
import { fmtLen, fromInches, toInches } from './units';

function selectModelFile(file: File | undefined, currentUrl: string | null, set: (k: any, v: any) => void) {
  if (!file) return;
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
  set('projModelUrl', URL.createObjectURL(file));
  set('projCanvasType', 'model');
}

function clearModel(currentUrl: string | null, set: (k: any, v: any) => void) {
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
  set('projModelUrl', null);
  set('projCanvasType', 'wall');
}

function loadSampleModel(set: (k: any, v: any) => void) {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  set('projModelUrl', `${cleanBase}adult.glb`);
  set('projCanvasType', 'model');
}

interface AxisRowProps {
  axis: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayVal: string;
  onChange: (val: number) => void;
}

function AxisRow({ axis, value, min, max, step, displayVal, onChange }: AxisRowProps) {
  return (
    <div className="transform-row">
      <span className="axis-label">{axis}</span>
      <input className="slider" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="axis-val">{displayVal}</span>
    </div>
  );
}

function updateRot(rot: [number, number, number], axis: 0 | 1 | 2, val: number, set: (k: any, v: any) => void) {
  const next: [number, number, number] = [...rot];
  next[axis] = val;
  set('projModelRot', next);
  if (axis === 1) set('projModelRotY', val);
}

function RotationControls({ rot, set }: { rot: [number, number, number]; set: (k: any, v: any) => void }) {
  return (
    <div className="transform-group">
      <div className="transform-head"><span className="row-label">Rotation</span></div>
      <div className="transform-rows">
        {(['X', 'Y', 'Z'] as const).map((ax, i) => (
          <AxisRow key={ax} axis={ax} value={rot[i]} min={-180} max={180} step={1}
            displayVal={`${rot[i]}°`} onChange={(v) => updateRot(rot, i as 0 | 1 | 2, v, set)} />
        ))}
      </div>
    </div>
  );
}

function updateOffset(off: [number, number, number], axis: 0 | 1 | 2, val: number, set: (k: any, v: any) => void) {
  const next: [number, number, number] = [...off];
  next[axis] = val;
  set('projModelOffset', next);
}

function TranslationControls({ off, units, set }: {
  off: [number, number, number]; units: Units; set: (k: any, v: any) => void;
}) {
  const metric = units === 'metric';
  const bounds = [metric ? 300 : 120, metric ? 150 : 60, metric ? 300 : 120];
  return (
    <div className="transform-group">
      <div className="transform-head"><span className="row-label">Translation</span></div>
      <div className="transform-rows">
        {(['X', 'Y', 'Z'] as const).map((ax, i) => (
          <AxisRow key={ax} axis={ax} value={Math.round(fromInches(off[i], units))}
            min={-bounds[i]} max={bounds[i]} step={metric ? 2 : 1}
            displayVal={fmtLen(off[i], units)}
            onChange={(v) => updateOffset(off, i as 0 | 1 | 2, toInches(v, units), set)} />
        ))}
      </div>
    </div>
  );
}

function ScaleControl({ scale, set }: { scale: number; set: (k: any, v: any) => void }) {
  return (
    <div className="transform-group">
      <div className="transform-head">
        <span className="row-label">Scale</span>
        <span className="num-readout">{scale.toFixed(2)}×</span>
      </div>
      <input className="slider" type="range" min={0.2} max={3.0} step={0.05} value={scale}
        onChange={(e) => set('projModelScale', Number(e.target.value))} />
    </div>
  );
}

function ModelActions({ url, onOpen, onSample, onClear }: {
  url: string | null; onOpen: () => void; onSample: () => void; onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
      <button className="ghost" onClick={onOpen}>Open...</button>
      {!url && <button className="ghost" onClick={onSample}>Sample Model</button>}
      {url && <button className="ghost" onClick={onClear}>Clear</button>}
    </div>
  );
}

export function ModelUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const units = useConfigStore((s) => s.units);
  const modelUrl = useConfigStore((s) => s.projModelUrl);
  const modelScale = useConfigStore((s) => s.projModelScale);
  const modelOffset = useConfigStore((s) => s.projModelOffset);
  const modelRot = useConfigStore((s) => s.projModelRot ?? [0, s.projModelRotY ?? 0, 0]);
  const set = useConfigStore((s) => s.set);

  return (
    <div className="model-upload" title="Loaded into memory only — nothing uploaded to servers.">
      <input ref={inputRef} type="file" accept=".glb,.gltf,.fbx" hidden
        onChange={(e) => selectModelFile(e.target.files?.[0], modelUrl, set)} />
      <ModelActions url={modelUrl} onOpen={() => inputRef.current?.click()}
        onSample={() => loadSampleModel(set)} onClear={() => clearModel(modelUrl, set)} />
      {modelUrl && (
        <div className="model-controls">
          <RotationControls rot={modelRot} set={set} />
          <TranslationControls off={modelOffset} units={units} set={set} />
          <ScaleControl scale={modelScale} set={set} />
        </div>
      )}
    </div>
  );
}
