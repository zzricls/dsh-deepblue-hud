import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { mapActivity } from './activity'
import { publishLive, resetLive } from './live'
import { buildLiveSnapshot } from './liveModel'
import type { PressureView, UsageView } from './liveModel'
import type { Sample } from './types'

/**
 * The subset of the slot props this bridge reads.
 *
 * `conversation.input.dock` provides all three hooks; declared structurally so a
 * composition without them degrades to an empty snapshot instead of throwing.
 */
export interface BridgeProps {
  useProjection?: (key: string) => unknown
  useTrajectory?: (selector: (snapshot: unknown) => unknown) => unknown
}

/** Samples kept for the gallery charts (one per changed second). */
const HISTORY_LIMIT = 180

/** Exponential smoothing state for the throughput readout. */
interface SpeedState {
  lastOutput: number
  lastAt: number
  ema: number
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Session collector: renders nothing, publishes everything.
 *
 * Mounted into a session-scoped slot because that is where the projection and
 * trajectory hooks exist; the frame-wide `shell.overlay` panel cannot reach them
 * from `root` scope. The component writes into the module-level live store, and
 * the panel reads from there through `useSyncExternalStore`.
 */
export function SessionDock (props: BridgeProps): ReactElement | null {
  const usage = (props.useProjection?.('tokenUsage') ?? undefined) as UsageView | undefined
  const pressure = (props.useProjection?.('contextPressure') ?? undefined) as PressureView | undefined
  const inspection = props.useTrajectory?.((snapshot: unknown) => snapshot)
  const speed = useRef<SpeedState>({ lastOutput: 0, lastAt: 0, ema: 0 })
  const diagnosed = useRef(false)
  const history = useRef<Sample[]>([])

  const tokensOut = typeof usage?.outputTokens === 'number' ? usage.outputTokens : 0
  const now = Date.now()
  if (tokensOut > speed.current.lastOutput) {
    const elapsed = speed.current.lastAt === 0 ? 0 : (now - speed.current.lastAt) / 1000
    const instant = elapsed > 0 ? (tokensOut - speed.current.lastOutput) / elapsed : 0
    if (instant > 0) speed.current.ema = speed.current.ema * 0.55 + instant * 0.45
    speed.current.lastOutput = tokensOut
    speed.current.lastAt = now
  }

  const runningCalls = isRecord(inspection) && Array.isArray(inspection.runningCalls)
    ? inspection.runningCalls.length
    : 0
  const tokensFlowing = speed.current.lastAt !== 0 && Date.now() - speed.current.lastAt < 3000
  const running = runningCalls > 0 || tokensFlowing
  const activity = mapActivity(inspection, running, 80)

  // The inspection is a client-internal shape that can change between releases.
  // When it is present but yields nothing, say so once with the real keys: that
  // one line is what a maintainer needs to extend the mapper.
  if (activity.length === 0 && isRecord(inspection) && !diagnosed.current) {
    diagnosed.current = true
    console.debug('[deepblue-hud] trajectory inspection not mapped; keys:', Object.keys(inspection), inspection)
  }

  const projectionKey = [
    usage?.uncachedInputTokens ?? '',
    usage?.outputTokens ?? '',
    usage?.cacheReadTokens ?? '',
    usage?.cacheWriteTokens ?? '',
    pressure?.contextWindow ?? '',
    pressure?.projectedTokens ?? '',
    pressure?.pressureTokens ?? '',
  ].join(':')
  const activityKey = activity.map(line => `${line.id}|${line.text}|${line.status}`).join('~') + (running ? '!' : '')

  useEffect(() => {
    const publish = (): void => {
      const state = speed.current
      if (state.lastAt !== 0 && Date.now() - state.lastAt > 2500) state.ema = 0
      const base = buildLiveSnapshot({ usage, pressure, speed: state.ema })
      // Sample every tick, not only on change: the charts need a time axis, and
      // a flat line of quiet seconds is information too.
      history.current = [...history.current, {
        t: Date.now(),
        tokensIn: base.session.tokensIn,
        tokensOut: base.session.tokensOut,
        contextUsed: base.session.contextUsed,
        contextMax: base.session.contextMax,
      }].slice(-HISTORY_LIMIT)
      publishLive({ ...base, activity, running, history: history.current })
    }
    publish()
    const timer = globalThis.setInterval(publish, 1000)
    return () => {
      globalThis.clearInterval(timer)
      resetLive()
    }
    // `projectionKey`/`activityKey` fold every field the mapping reads, so the
    // interval restarts on real movement instead of object identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectionKey, activityKey])

  return null
}
