// Renders parametric projection canvases (wall, curved screen, cylinder)
// and applies the multi-projector shader material.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { makeTestPatternCanvas } from '../scene/testPattern';
import { useConfigStore } from '../store/useConfigStore';
import type { ProjectorSpec } from './projectiveOptics';
import {
  createProjectiveMaterial,
  makeHeatmapRampTexture,
  updateProjectiveMaterialUniforms,
} from './projectiveMaterial';
import { ProjectorShadowPass, MAX_PROJECTORS } from './ProjectorShadowPass';
import { ModelCanvasMesh } from './ModelCanvasMesh';

export type CanvasType = 'wall' | 'curved' | 'cylinder' | 'model';

interface CanvasMeshProps {
  canvasType: CanvasType;
  specs: ProjectorSpec[];
  nominalFc: number;
  distFt: number;
  overlapFrac: number;
  wallWidthFt: number;
  wallHeightFt: number;
  centerY: number;
  curvedRadiusFt?: number;
  curvedArcDeg?: number;
}

function makeCurvedPlane(
  height: number,
  centerY: number,
  radiusFt: number,
  arcDeg = 60,
): THREE.BufferGeometry {
  const isConvex = radiusFt < 0;
  const R = Math.max(1, Math.abs(radiusFt));
  const arcRad = (Math.max(10, Math.min(180, arcDeg)) * Math.PI) / 180;
  const segX = 64;
  const segY = 16;

  const geo = new THREE.BufferGeometry();
  const vertexCount = (segX + 1) * (segY + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  let vertIdx = 0;
  let uvIdx = 0;

  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    const y = (v - 0.5) * height + centerY;

    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const theta = (u - 0.5) * arcRad;

      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      const x = R * sinT;
      const z = isConvex ? -R * (1 - cosT) : R * (1 - cosT);

      positions[vertIdx * 3] = x;
      positions[vertIdx * 3 + 1] = y;
      positions[vertIdx * 3 + 2] = z;

      const nx = isConvex ? sinT : -sinT;
      const nz = cosT;
      const len = Math.hypot(nx, nz) || 1;

      normals[vertIdx * 3] = nx / len;
      normals[vertIdx * 3 + 1] = 0;
      normals[vertIdx * 3 + 2] = nz / len;

      uvs[uvIdx * 2] = u;
      uvs[uvIdx * 2 + 1] = v;

      vertIdx++;
      uvIdx++;
    }
  }

  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i;
      const b = (j + 1) * (segX + 1) + i;
      const c = (j + 1) * (segX + 1) + (i + 1);
      const d = j * (segX + 1) + (i + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function makeColumn(radius: number, height: number, centerY: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, false);
  geo.translate(0, centerY, 0);
  return geo;
}

export function ProjectionCanvasMesh({
  canvasType,
  specs,
  nominalFc,
  distFt,
  overlapFrac,
  wallWidthFt,
  wallHeightFt,
  centerY,
  curvedRadiusFt = 14,
  curvedArcDeg = 60,
}: CanvasMeshProps) {
  const view = useConfigStore((s) => s.projSurfaceView);
  const contentUrl = useConfigStore((s) => s.contentUrl);
  const aspectW = useConfigStore((s) => s.projAspectW);
  const aspectH = useConfigStore((s) => s.projAspectH);
  const screenGain = useConfigStore((s) => s.projScreenGain);
  const modelUrl = useConfigStore((s) => s.projModelUrl);
  const modelName = useConfigStore((s) => s.projModelName);

  const meshRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => createProjectiveMaterial(), []);
  const heatRampTex = useMemo(() => makeHeatmapRampTexture(), []);
  const shadowPass = useMemo(() => new ProjectorShadowPass(), []);

  const shadowTextures = useMemo(
    () => Array.from({ length: MAX_PROJECTORS }, (_, i) => shadowPass.getDepthTexture(i)),
    [shadowPass],
  );

  useEffect(() => () => {
    mat.dispose();
    heatRampTex.dispose();
    shadowPass.dispose();
  }, [mat, heatRampTex, shadowPass]);

  useFrame(({ gl }) => {
    if (!meshRef.current) return;
    shadowPass.render(gl, meshRef.current, specs);
  });

  const contentTex = useMemo(() => {
    const canvas = makeTestPatternCanvas(aspectW, aspectH, 100);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [aspectW, aspectH]);

  useEffect(() => () => contentTex.dispose(), [contentTex]);

  useEffect(() => {
    if (view !== 'content' || !contentUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      contentTex.image = canvas;
      contentTex.needsUpdate = true;
    };
    img.src = contentUrl;
  }, [view, contentUrl, contentTex]);

  const canvasHeightIn = useConfigStore((s) => s.projCanvasHeight);
  const physicalCanvasHeightFt = canvasHeightIn / 12;

  const geo = useMemo(() => {
    if (canvasType === 'curved') {
      return makeCurvedPlane(
        physicalCanvasHeightFt,
        physicalCanvasHeightFt / 2,
        curvedRadiusFt,
        curvedArcDeg,
      );
    }
    if (canvasType === 'cylinder') {
      const COLUMN_HEIGHT_FT = 14;
      return makeColumn(Math.abs(curvedRadiusFt) / 3, COLUMN_HEIGHT_FT, COLUMN_HEIGHT_FT / 2);
    }
    const g = new THREE.PlaneGeometry(wallWidthFt, wallHeightFt);
    g.translate(0, centerY, 0);
    return g;
  }, [canvasType, curvedRadiusFt, curvedArcDeg, physicalCanvasHeightFt, wallHeightFt, wallWidthFt, centerY]);

  useEffect(() => () => geo.dispose(), [geo]);

  useEffect(() => {
    updateProjectiveMaterialUniforms(
      mat,
      specs,
      nominalFc,
      distFt,
      overlapFrac,
      contentTex,
      heatRampTex,
      view,
      screenGain,
      shadowTextures,
    );
  }, [
    mat,
    specs,
    nominalFc,
    distFt,
    overlapFrac,
    contentTex,
    heatRampTex,
    view,
    screenGain,
    shadowTextures,
  ]);

  if (canvasType === 'model' && modelUrl) {
    return (
      <ModelCanvasMesh
        modelUrl={modelUrl}
        modelName={modelName}
        mat={mat}
        shadowPass={shadowPass}
        specs={specs}
      />
    );
  }

  return <mesh ref={meshRef} geometry={geo} material={mat} />;
}
