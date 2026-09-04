// Coalesces store writes into at most one commit per animation frame. A range
// slider fires a native `input` event on every drag tick — often faster than
// the screen repaints — and each commit today re-renders every subscriber,
// repaints any heatmap keyed off the changed field, and writes the whole
// persisted snapshot to localStorage. Batching those into one flush per frame
// keeps visuals live during a drag without redoing that work per tick.
//
// Falls back to an immediate, synchronous write wherever `requestAnimationFrame`
// doesn't exist (the Node test environment) — set() keeps its existing
// synchronous contract there, so no test needs to change.

type Patch<T> = Partial<T>;
type RawSet<T> = (partial: Patch<T>) => void;

export function createRafBatchedSetter<T extends object>(rawSet: RawSet<T>): RawSet<T> {
  if (typeof requestAnimationFrame !== 'function') return rawSet;

  let pending: Patch<T> | null = null;
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    if (!pending) return;
    const patch = pending;
    pending = null;
    rawSet(patch);
  };

  // Don't lose the last drag tick if the tab is closed/reloaded before the
  // next frame paints.
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);

  return (partial: Patch<T>) => {
    pending = pending ? { ...pending, ...partial } : partial;
    if (frame === null) frame = requestAnimationFrame(flush);
  };
}
