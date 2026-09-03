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
  width: number,
  height: number,
  centerY: number,
  radius: number,
): THREE.BufferGeometry {
  const segX = 48;
  const segY = 8;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const R = Math.max(radius, width / 2.5);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const theta = x / R;
    const newX = R * Math.sin(theta);
    const newZ = R * (Math.cos(theta) - 1);
    pos.setXYZ(i, newX, y + centerY, newZ);

    const nx = -Math.sin(theta);
    const nz = Math.cos(theta);
    norm.setXYZ(i, nx, 0, nz);
  }
  pos.needsUpdate = true;
  norm.needsUpdate = true;
  geo.computeVertexNormals();
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
}: CanvasMeshProps) {
  const view = useConfigStore((s) => s.projSurfaceView);
  const contentUrl = useConfigStore((s) => s.contentUrl);
  const aspectW = useConfigStore((s) => s.projAspectW);
  const aspectH = useConfigStore((s) => s.projAspectH);
  const screenGain = useConfigStore((s) => s.projScreenGain);
  const modelUrl = useConfigStore((s) => s.projModelUrl);

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

  const tiltDeg = useConfigStore((s) => s.projTiltDeg);

  useFrame(({ gl }) => {
    if (!meshRef.current) return;
    shadowPass.render(gl, meshRef.current, specs, tiltDeg);
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

  const geo = useMemo(() => {
    if (canvasType === 'curved') {
      return makeCurvedPlane(wallWidthFt, wallHeightFt, centerY, curvedRadiusFt);
    }
    if (canvasType === 'cylinder') {
      const g = new THREE.CylinderGeometry(curvedRadiusFt / 3, curvedRadiusFt / 3, wallHeightFt, 48, 1, true);
      g.translate(0, centerY, 0);
      return g;
    }
    const g = new THREE.PlaneGeometry(wallWidthFt, wallHeightFt);
    g.translate(0, centerY, 0);
    return g;
  }, [canvasType, curvedRadiusFt, wallHeightFt, wallWidthFt, centerY]);

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
        mat={mat}
        shadowPass={shadowPass}
        specs={specs}
        wallHeightFt={wallHeightFt}
        centerY={centerY}
        tiltDeg={tiltDeg}
      />
    );
  }

  return <mesh ref={meshRef} geometry={geo} material={mat} />;
}
