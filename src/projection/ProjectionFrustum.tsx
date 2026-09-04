import { Line } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { type FrustumGeometry, type Vec3, type LensOrigin } from './projectionMath';

export interface LocalFrustumParams {
  throwRatio: number;
  aspectW: number;
  aspectH: number;
  lensShiftPct: number;
  lensShiftXPct?: number;
  lensOrigin: LensOrigin;
  distanceFt: number;
}

export function computeLocalFrustumCorners(p: LocalFrustumParams): {
  lens: Vec3;
  topLeft: Vec3;
  topRight: Vec3;
  bottomRight: Vec3;
  bottomLeft: Vec3;
} {
  const d = Math.max(0.5, p.distanceFt);
  const w = p.throwRatio > 0 ? d / p.throwRatio : d;
  const h = p.aspectW > 0 ? w * (p.aspectH / p.aspectW) : w * (9 / 16);
  const baselineTop = p.lensOrigin === 'top' ? 0 : h / 2;
  const shiftY = (p.lensShiftPct / 100) * (h / 2);
  const topY = baselineTop + shiftY;
  const bottomY = topY - h;
  const halfW = w / 2;
  const centerX = ((p.lensShiftXPct ?? 0) / 100) * halfW;

  return {
    lens: [0, 0, 0],
    topLeft: [centerX - halfW, topY, -d],
    topRight: [centerX + halfW, topY, -d],
    bottomRight: [centerX + halfW, bottomY, -d],
    bottomLeft: [centerX - halfW, bottomY, -d],
  };
}

export function ProjectionFrustum({
  geom,
  localParams,
  color,
  isSelected,
  onSelect,
}: {
  geom?: FrustumGeometry;
  localParams?: LocalFrustumParams;
  color: string;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const corners = useMemo(() => {
    if (localParams) return computeLocalFrustumCorners(localParams);
    if (geom) return geom;
    return {
      lens: [0, 0, 0] as Vec3,
      topLeft: [-5, 5, -15] as Vec3,
      topRight: [5, 5, -15] as Vec3,
      bottomRight: [5, -5, -15] as Vec3,
      bottomLeft: [-5, -5, -15] as Vec3,
    };
  }, [geom, localParams]);

  const { lens, topLeft, topRight, bottomRight, bottomLeft } = corners;

  const solid = useMemo(() => {
    const c: Vec3[] = [lens, topLeft, topRight, bottomRight, bottomLeft];
    const positions = new Float32Array(c.flatMap((p) => p));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    geo.computeVertexNormals();
    return geo;
  }, [lens, topLeft, topRight, bottomRight, bottomLeft]);
  useEffect(() => () => solid.dispose(), [solid]);

  const edges: [Vec3, Vec3][] = [
    [lens, topLeft],
    [lens, topRight],
    [lens, bottomRight],
    [lens, bottomLeft],
  ];

  const rect: Vec3[] = [topLeft, topRight, bottomRight, bottomLeft, topLeft];
  const bodyColor = isSelected ? '#2563eb' : '#1b2430';

  return (
    <group>
      <mesh geometry={solid}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.2 : 0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {edges.map(([a, b], i) => (
        <Line key={i} points={[a, b]} color={color} lineWidth={isSelected ? 2 : 1.5} transparent opacity={0.7} />
      ))}
      <Line points={rect} color={color} lineWidth={isSelected ? 2 : 1.5} transparent opacity={0.7} />
      {/* Projector body at lens origin */}
      <mesh
        position={localParams ? [0, 0, 0.8] : lens}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      >
        <boxGeometry args={[1.1, 0.5, 1.6]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} />
      </mesh>
    </group>
  );
}
