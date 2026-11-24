import type { HudSnapshot } from './types'

/**
 * One published snapshot plus the listeners that watch it.
 *
 * The bridge component (mounted in a session-scoped slot) is the only writer; the
 * frame-wide panel reads through `useSyncExternalStore`, so both stay in step
 * without the panel subscribing to the session itself.
 */

/** Shape with no session attached: zeroed, with every unavailable block hidden. */
export const EMPTY_SNAPSHOT: HudSnapshot = {
  mode: 'idle',
  session: {
    tokensIn: 0,
    tokensOut: 0,
    speed: 0,
    contextUsed: null,
    contextMax: null,
    cost: null,
  },
  system: { cpuPercent: null, memory: null, diskPercent: null, network: null },
  activity: [],
  history: [],
  running: false,
  pending: { system: true, activity: true },
}

let current: HudSnapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

/** Current snapshot; the same reference until the next publish. */
export function getLiveSnapshot (): HudSnapshot {
  return current
}

/**
 * Subscribe to publishes.
 *
 * @param listener - called after every publish.
 * @returns the unsubscribe function.
 */
export function subscribeLive (listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Replace the snapshot.
 *
 * @param next - the new snapshot.
 */
export function publishLive (next: HudSnapshot): void {
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

/** Drop back to the empty snapshot, e.g. when the bridge unmounts. */
export function resetLive (): void {
  publishLive(EMPTY_SNAPSHOT)
}
