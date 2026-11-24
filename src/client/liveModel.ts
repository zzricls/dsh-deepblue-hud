import { estimateCost } from './pricing'
import type { HudSnapshot } from './types'

/** Raw `tokenUsage` wire view (the projection's `totals`). */
export interface UsageView {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** Raw `contextPressure` wire view. */
export interface PressureView {
  contextWindow?: number
  pressureTokens?: number
  projectedTokens?: number
}

/** Inputs the bridge folds into one snapshot. */
export interface LiveInput {
  usage?: UsageView | undefined
  pressure?: PressureView | undefined
  /** Smoothed output tokens per second. */
  speed: number
  /** Model id, when the session's selection is known. */
  model?: string | undefined
}

function count (value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function optionalNumber (value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Project the raw session projections onto the HUD snapshot.
 *
 * Pure on purpose: the mapping is the part worth testing, and keeping it out of
 * the component means the smoke test can assert it without a renderer.
 *
 * @param input - projection views plus the smoothed rate.
 * @returns the snapshot published to the store.
 */
export function buildLiveSnapshot (input: LiveInput): HudSnapshot {
  const usage = input.usage ?? {}
  const pressure = input.pressure ?? {}
  const uncached = count(usage.uncachedInputTokens)
  const cacheRead = count(usage.cacheReadTokens)
  const cacheWrite = count(usage.cacheWriteTokens)

  const contextUsed = optionalNumber(pressure.projectedTokens) ?? optionalNumber(pressure.pressureTokens)
  const contextMax = optionalNumber(pressure.contextWindow)

  return {
    mode: 'live',
    session: {
      tokensIn: uncached + cacheRead + cacheWrite,
      tokensOut: count(usage.outputTokens),
      speed: Math.max(0, Math.round(input.speed * 10) / 10),
      contextUsed,
      contextMax,
      cost: estimateCost(
        { uncachedInputTokens: uncached, outputTokens: count(usage.outputTokens), cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
        input.model,
      ),
    },
    system: { cpuPercent: null, memory: null, diskPercent: null, network: null },
    activity: [],
    history: [],
    running: false,
    pending: { system: true, activity: true },
  }
}
