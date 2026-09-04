// Renders loaded 3D models (GLTF/GLB/FBX) as projection canvas surfaces.

import { useFBX, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useConfigStore } from '../store/useConfigStore';
import type { ProjectorSpec } from './projectiveOptics';
import { ProjectorShadowPass } from './ProjectorShadowPass';

function ftFromIn(inches: number): number {
  return inches / 12;
}

interface ModelCanvasMeshProps {
  modelUrl: string;
  modelName?: string | null;
  mat: THREE.ShaderMaterial;
  shadowPass: ProjectorShadowPass;
  specs: ProjectorSpec[];
  // Exposes the model's root group to the caller so it can raycast projector
  // aim against the actual loaded geometry (see useProjectorFocusRaycast).
  targetRef?: React.RefObject<THREE.Object3D | null>;
}

interface ModelRendererProps extends ModelCanvasMeshProps {
  scene: THREE.Object3D;
}

function ModelRenderer({
  scene,
  mat,
  shadowPass,
  specs,
  targetRef,
}: ModelRendererProps) {
  const modelScale = useConfigStore((s) => s.projModelScale);
  const modelOffset = useConfigStore((s) => s.projModelOffset);
  const modelRot = useConfigStore((s) => s.projModelRot ?? [0, s.projModelRotY ?? 0, 0]);

  const groupRef = useRef<THREE.Group>(null);

  const prep = useMemo(() => {
    const root = skeletonClone(scene) as THREE.Object3D;
    root.traverse((o) => {
      const any = o as unknown as { isLight?: boolean; isCamera?: boolean; isMesh?: boolean };
      if (any.isLight || any.isCamera) o.visible = false;
      if (any.isMesh) {
        (o as THREE.Mesh).material = mat;
        (o as THREE.Mesh).frustumCulled = false;
      }
    });

    root.rotation.set(0, Math.PI, 0);
    root.updateMatrixWorld(true);

    const tempBox = new THREE.Box3().setFromObject(root);
    const size = tempBox.getSize(new THREE.Vector3());
    const center = tempBox.getCenter(new THREE.Vector3());
    const baseHeight = Math.max(0.001, size.y);

    return { root, size, center, baseHeight };
  }, [scene, mat]);

  // Life-size 6.0 ft reference height for 1x scale, completely decoupled from projector throw
  const REFERENCE_MODEL_HEIGHT_FT = 6.0;
  const targetHeight = REFERENCE_MODEL_HEIGHT_FT * modelScale;
  const scale = targetHeight / prep.baseHeight;

  useFrame(({ gl }) => {
    if (!groupRef.current) return;
    shadowPass.render(gl, groupRef.current, specs);
  });

  return (
    <group
      ref={(el) => {
        groupRef.current = el;
        if (targetRef) targetRef.current = el;
      }}
      position={[ftFromIn(modelOffset[0]), ftFromIn(modelOffset[1]), ftFromIn(modelOffset[2])]}
      rotation={[
        (modelRot[0] * Math.PI) / 180,
        (modelRot[1] * Math.PI) / 180,
        (modelRot[2] * Math.PI) / 180,
      ]}
    >
      <group position={[-prep.center.x * scale, -prep.center.y * scale + targetHeight / 2, -prep.center.z * scale]} scale={scale}>
        <primitive object={prep.root} />
      </group>
    </group>
  );
}

function GltfInner(props: ModelCanvasMeshProps) {
  const { scene } = useGLTF(props.modelUrl);
  return <ModelRenderer {...props} scene={scene} />;
}

function FbxInner(props: ModelCanvasMeshProps) {
  const fbx = useFBX(props.modelUrl);
  return <ModelRenderer {...props} scene={fbx} />;
}

function ModelInner(props: ModelCanvasMeshProps) {
  // A blob: URL never carries the original filename, so prefer the tracked name
  // (set on upload, restored from IndexedDB on reload) and fall back to the URL
  // for asset-path models like the bundled sample.
  const isFbx = (props.modelName ?? props.modelUrl).toLowerCase().includes('.fbx');
  return isFbx ? <FbxInner {...props} /> : <GltfInner {...props} />;
}

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('Model loading failed:', err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ModelCanvasMesh(props: ModelCanvasMeshProps) {
  return (
    <ModelBoundary>
      <Suspense fallback={null}>
        <ModelInner {...props} />
      </Suspense>
    </ModelBoundary>
  );
}
