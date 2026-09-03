// Dedicated depth render pass for Projector Shadow Mapping (PSM).
// Renders depth from each projector's virtual camera into a WebGLRenderTarget.

import * as THREE from 'three';
import type { ProjectorSpec } from './projectiveOptics';

const SHADOW_MAP_SIZE = 1024;
export const MAX_PROJECTORS = 4;

export class ProjectorShadowPass {
  private targets: THREE.WebGLRenderTarget[] = [];
  private depthCamera: THREE.PerspectiveCamera;
  private depthMaterial: THREE.MeshDepthMaterial;

  constructor() {
    this.depthCamera = new THREE.PerspectiveCamera();
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < MAX_PROJECTORS; i++) {
      const target = new THREE.WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      });
      target.depthTexture = new THREE.DepthTexture(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
      target.depthTexture.type = THREE.UnsignedIntType;
      this.targets.push(target);
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    canvasMesh: THREE.Object3D,
    specs: ProjectorSpec[],
    tiltDeg = 0,
  ): void {
    const prevTarget = renderer.getRenderTarget();
    canvasMesh.updateWorldMatrix(true, true);

    const savedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    canvasMesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        savedMaterials.set(m, m.material);
        m.material = this.depthMaterial;
      }
    });

    specs.slice(0, MAX_PROJECTORS).forEach((spec, i) => {
      const target = this.targets[i];
      if (!target) return;

      this.depthCamera.matrixAutoUpdate = false;
      this.depthCamera.matrixWorldAutoUpdate = false;
      this.depthCamera.position.set(spec.lens[0], spec.lens[1], spec.lens[2]);
      this.depthCamera.rotation.set((tiltDeg * Math.PI) / 180, 0, 0);
      this.depthCamera.updateMatrixWorld(true);
      this.depthCamera.projectionMatrix.fromArray(spec.projMatrix);
      this.depthCamera.projectionMatrixInverse.copy(this.depthCamera.projectionMatrix).invert();

      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(canvasMesh as THREE.Scene, this.depthCamera);
    });

    savedMaterials.forEach((originalMat, m) => {
      m.material = originalMat;
    });

    renderer.setRenderTarget(prevTarget);
  }

  getDepthTexture(index: number): THREE.Texture | null {
    return this.targets[index]?.depthTexture ?? null;
  }

  dispose(): void {
    this.targets.forEach((t) => t.dispose());
    this.depthMaterial.dispose();
  }
}
