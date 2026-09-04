// Reconstructs `projModelUrl` after reload — the URL itself is never persisted
// (a blob: URL dies with the page, and a stale one would just fail to load), so
// this rebuilds it from whichever source produced it: the bundled sample asset,
// or an uploaded file recovered from IndexedDB.

import { loadModelBlob } from './modelBlobStore';
import type { ConfigState } from './useConfigStore';

export function sampleModelUrl(name: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${name}`;
}

async function restoreUpload(state: ConfigState, id: string): Promise<void> {
  const stored = await loadModelBlob(id).catch(() => undefined);
  if (stored) {
    state.set('projModelUrl', URL.createObjectURL(stored.blob));
    state.set('projModelName', stored.name);
    return;
  }
  // Blob is gone (cleared site data, private browsing) — drop the stale reference
  // instead of leaving the canvas pointed at a model that will never load.
  state.set('projModelId', null);
  state.set('projModelName', null);
  state.set('projModelSource', null);
  state.set('projCanvasType', 'wall');
}

export function restoreModel(state: ConfigState): void {
  if (state.projModelSource === 'sample' && state.projModelName) {
    state.set('projModelUrl', sampleModelUrl(state.projModelName));
  } else if (state.projModelSource === 'upload' && state.projModelId) {
    void restoreUpload(state, state.projModelId);
  }
}
