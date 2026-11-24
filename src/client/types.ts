/**
 * Shapes the HUD renders. They are the contract between the live source
 * (`Bridge.tsx` → `live.ts`) and the view, so swapping the data in does not touch
 * the panel.
 */

/** Severity used by every bar, dot and value color in the panel. */
export type Tone = 'accent' | 'success' | 'warn' | 'error'

/**
 * Session economy. `null` means "the source does not publish this yet" and the
 * block is hidden rather than shown as zero.
 */
export interface SessionEconomy {
  /** Prompt-side tokens: uncached input plus cache reads and writes. */
  tokensIn: number
  /** Completion tokens. */
  tokensOut: number
  /** Output speed in tokens per second, smoothed; `0` when idle. */
  speed: number
  /** Context window occupancy. */
  contextUsed: number | null
  contextMax: number | null
  /** Estimated spend in CNY, or `null` when no rate row matches. */
  cost: number | null
}

/** A used/total pair that renders as a percentage bar. */
export interface Usage {
  used: number
  total: number
  percent: number
}

/**
 * Host-machine vitals. Every member may be `null`: a metric the Host cannot read
 * is **hidden**, never rendered as zero, so a missing reading cannot be mistaken
 * for an idle machine.
 */
export interface SystemVitals {
  cpuPercent: number | null
  memory: Usage | null
  diskPercent: number | null
  /** Bytes per second. */
  network: { rx: number; tx: number } | null
}

/** Node state on the activity rail. */
export type NodeStatus = 'ok' | 'warn' | 'error'

/**
 * One line of the live activity stream.
 *
 * `tool` lines are commands the agent ran; `think` lines are reasoning text. The
 * stream is flat on purpose: parallel calls render as a group line plus indented
 * children, which types out the same way and needs no tree walker in the view.
 */
export interface ActivityLine {
  id: string
  kind: 'think' | 'tool'
  text: string
  status: NodeStatus
  /** Right-aligned annotation, e.g. `120ms`, `retry 1`. */
  meta?: string
  /** Nesting level for parallel groups. */
  indent?: number
}

/** Where the numbers come from. `idle` means no session is attached yet. */
export type SnapshotMode = 'idle' | 'live'

/** One sampled reading, kept for the rolling charts. */
export interface Sample {
  /** Timestamp (ms). */
  t: number
  tokensIn: number
  tokensOut: number
  contextUsed: number | null
  contextMax: number | null
}

/** Everything the panel draws. */
export interface HudSnapshot {
  mode: SnapshotMode
  session: SessionEconomy
  system: SystemVitals
  /** Trailing activity lines, oldest first. */
  activity: ActivityLine[]
  /** Rolling samples for the data-flow gallery, oldest first. */
  history: Sample[]
  /** Whether the agent is currently working (drives the caret). */
  running: boolean
  /** Blocks still waiting for a real source; rendered as a muted hint. */
  pending: {
    system: boolean
    activity: boolean
  }
}
