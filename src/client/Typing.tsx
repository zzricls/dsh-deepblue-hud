import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ActivityLine } from './types'

/**
 * Typing speed: one tick every 26 ms, revealing a share of what is left so short
 * lines do not crawl and long ones do not stall.
 */
const TICK_MS = 26

/**
 * Reveal `target` progressively.
 *
 * The revealed count is monotonic for a given line: when the target grows (a
 * streamed reasoning delta, a longer command string) typing simply continues from
 * where it was. A new line gets a new React key, which resets the count.
 *
 * @param target - full text.
 * @param enabled - `false` renders the text at once (reduced motion, history).
 * @returns the visible prefix.
 */
export function useTyped (target: string, enabled: boolean): string {
  const [revealed, setRevealed] = useState(enabled ? 0 : target.length)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      setRevealed(target.length)
      return
    }
    if (revealed >= target.length) return
    timer.current = globalThis.setTimeout(() => {
      setRevealed(current => Math.min(target.length, current + Math.max(1, Math.ceil((target.length - current) / 10))))
    }, TICK_MS)
    return () => {
      if (timer.current !== undefined) globalThis.clearTimeout(timer.current)
    }
  }, [enabled, revealed, target.length])

  return target.slice(0, Math.min(revealed, target.length))
}

/** Props for one typed stream line. */
export interface TypingLineProps {
  line: ActivityLine
  /** Type this line out (only the freshest lines should). */
  typing: boolean
  /** Show a caret while the agent is working. */
  caret: boolean
}

/**
 * One line of the activity stream, typed out.
 *
 * This is the one place the plugin deliberately mutates text content instead of
 * animating `opacity`/`transform`: a typewriter *is* text reflow. It stays bounded
 * — one line, fixed line height, `contain: layout`, and reduced motion renders the
 * full text immediately.
 */
export function TypingLine (props: TypingLineProps): ReactElement {
  const text = useTyped(props.line.text, props.typing)
  const pending = text.length < props.line.text.length
  return (
    <div className="dbh-node" data-status={props.line.status}>
      <span className="dbh-dot" aria-hidden="true" />
      <div className="dbh-node-body" style={{ paddingLeft: `${(props.line.indent ?? 0) * 10}px` }}>
        <div className="dbh-node-label" title={props.line.text}>
          {text}
          {pending || props.caret ? <span className="dbh-caret" aria-hidden="true" /> : null}
        </div>
      </div>
      {props.line.meta === undefined ? null : <span className="dbh-node-meta">{props.line.meta}</span>}
    </div>
  )
}
