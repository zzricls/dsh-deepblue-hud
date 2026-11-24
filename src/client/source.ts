import { useSyncExternalStore } from 'react'
import { getLiveSnapshot, subscribeLive } from './live'
import type { HudSnapshot } from './types'

/**
 * The panel's single data seam.
 *
 * The bridge (`Bridge.tsx`) is the only writer; this hook just mirrors the live
 * store into React. Until a session mounts the bridge, the store holds the idle
 * snapshot — zeroed, with the unwired blocks marked pending in the view.
 */
export function useHudSnapshot (): HudSnapshot {
  return useSyncExternalStore(subscribeLive, getLiveSnapshot, getLiveSnapshot)
}
