import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { formatPercent, formatTokens, ratio } from './format'
import { TypingLine } from './Typing'
import type { HudSnapshot, Tone } from './types'

/**
 * Data-flow gallery: the cockpit expanded into one full-screen surface.
 *
 * Three panes over the rolling sample buffer the bridge publishes every second:
 * token rhythm (stacked bars), context occupancy (area + curve with its two
 * thresholds), and the thinking/execution stream (typed, full history).
 *
 * Charts are hand-rolled — a plugin may not import a chart library — and animate
 * with `transform` / `opacity` only.
 */

/** Bars drawn in the rhythm pane. */
const BARS = 60

function formatClock (t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function toneOf (value: number): Tone {
  if (value >= 0.9) return 'error'
  if (value >= 0.7) return 'warn'
  return 'success'
}

/** Per-second token deltas, with a visible stub for quiet seconds. */
function RhythmPane (props: { snapshot: HudSnapshot }): ReactElement {
  const samples = props.snapshot.history.slice(-(BARS + 1))
  const deltas = samples.slice(1).map((sample, index) => {
    const previous = samples[index]
    return {
      t: sample.t,
      input: Math.max(0, sample.tokensIn - (previous?.tokensIn ?? 0)),
      output: Math.max(0, sample.tokensOut - (previous?.tokensOut ?? 0)),
    }
  })
  const peak = Math.max(1, ...deltas.map(delta => delta.input + delta.output))
  const total = deltas.reduce((sum, delta) => sum + delta.input + delta.output, 0)
  const busiest = deltas.reduce((max, delta) => Math.max(max, delta.input + delta.output), 0)

  return (
    <section className="dbh-gal-pane" aria-label="token 节奏">
      <header className="dbh-gal-pane-head">
        <span>token 节奏</span>
        <span className="dbh-gal-pane-note">{deltas.length} 秒 · 共 {total} token</span>
      </header>
      <div className="dbh-gal-stats">
        <span><b>{total}</b>合计</span>
        <span><b>{busiest}</b>峰值/秒</span>
        <span><b>{deltas.length === 0 ? 0 : Math.round(total / deltas.length)}</b>均值/秒</span>
      </div>
      {deltas.length === 0 ? (
        <div className="dbh-hint">{props.snapshot.mode === 'idle' ? '等待会话' : '刚开始采样'}</div>
      ) : (
        <div className="dbh-gal-bars">
          {deltas.map(delta => {
            const value = delta.input + delta.output
            const share = Math.max(value / peak, value > 0 ? 0.08 : 0.015)
            // Where the input colour stops and the output colour starts, as a
            // percentage from the bottom of the bar.
            const split = value === 0 ? 0 : (delta.input / value) * 100
            return (
              <div
                key={delta.t}
                className="dbh-gal-bar"
                data-empty={value === 0 ? 'true' : 'false'}
                title={`${formatClock(delta.t)} · 入 ${delta.input} / 出 ${delta.output}`}
              >
                <span
                  className="dbh-gal-bar-fill"
                  style={{ transform: `scaleY(${share})`, ['--dbh-split' as string]: `${split.toFixed(1)}%` }}
                />
              </div>
            )
          })}
        </div>
      )}
      <footer className="dbh-gal-legend">
        <span><i className="dbh-gal-key" data-kind="in" />入</span>
        <span><i className="dbh-gal-key" data-kind="out" />出</span>
        <span className="dbh-gal-legend-time">每秒采样 · 最近 {BARS} 秒</span>
      </footer>
    </section>
  )
}

/** Context occupancy: filled area, curve, thresholds, live point, stats. */
function ContextPane (props: { snapshot: HudSnapshot }): ReactElement {
  const points = props.snapshot.history
    .map(sample => (sample.contextUsed === null || sample.contextMax === null || sample.contextMax <= 0
      ? null
      : ratio(sample.contextUsed, sample.contextMax)))
    .filter((value): value is number => value !== null)
  const current = points.at(-1) ?? 0
  const peak = points.length === 0 ? 0 : Math.max(...points)
  const average = points.length === 0 ? 0 : points.reduce((sum, value) => sum + value, 0) / points.length
  const last = props.snapshot.history.at(-1)
  const line = points.length < 2
    ? ''
    : points
      .map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (points.length - 1)) * 100} ${(1 - Math.min(value, 1)) * 100}`)
      .join(' ')
  const area = line === '' ? '' : `${line} L 100 100 L 0 100 Z`
  const contextLabel = last === undefined || last.contextUsed === null
    ? '待接入'
    : `${formatTokens(last.contextUsed)} / ${formatTokens(last.contextMax ?? 0)}`

  return (
    <section className="dbh-gal-pane" aria-label="上下文占用">
      <header className="dbh-gal-pane-head">
        <span>上下文占用</span>
        <span className="dbh-gal-pane-note">{contextLabel}</span>
      </header>
      {points.length === 0 ? (
        <div className="dbh-hint">上下文待接入</div>
      ) : (
        <>
          <div className="dbh-gal-stats">
            <span><b>{formatPercent(current * 100)}</b>当前</span>
            <span><b>{formatPercent(peak * 100)}</b>峰值</span>
            <span><b>{formatPercent(average * 100)}</b>均值</span>
          </div>
          <div className="dbh-gal-curve">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="上下文占用曲线">
              <line className="dbh-gal-grid-line" x1="0" y1="25" x2="100" y2="25" />
              <line className="dbh-gal-grid-line" x1="0" y1="50" x2="100" y2="50" />
              <line className="dbh-gal-grid-line" x1="0" y1="75" x2="100" y2="75" />
              <line className="dbh-gal-th" data-tone="warn" x1="0" y1="30" x2="100" y2="30" />
              <line className="dbh-gal-th" data-tone="error" x1="0" y1="10" x2="100" y2="10" />
              {area === '' ? null : <path className="dbh-gal-area" d={area} />}
              {line === '' ? null : <path className="dbh-gal-line" d={line} />}
            </svg>
            <span
              className="dbh-gal-point"
              data-tone={toneOf(current)}
              style={{ left: '100%', top: `${(1 - Math.min(current, 1)) * 100}%` }}
            />
            <div className="dbh-gal-th-labels">
              <span>90%</span>
              <span>70%</span>
            </div>
            <div className="dbh-gal-chip" data-tone={toneOf(current)}>{formatPercent(current * 100)}</div>
          </div>
        </>
      )}
    </section>
  )
}

/** Thinking and execution stream, typed, full history, auto-scrolled. */
function StreamPane (props: { snapshot: HudSnapshot }): ReactElement {
  const list = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = list.current
    if (node !== null) node.scrollTop = node.scrollHeight
  }, [props.snapshot.activity.length, props.snapshot.running])
  const lines = props.snapshot.activity
  const last = lines.length - 1
  return (
    <section className="dbh-gal-pane" aria-label="思考与执行">
      <header className="dbh-gal-pane-head">
        <span>思考与执行</span>
        <span className="dbh-gal-pane-note">{lines.length} 条 · 最新在下</span>
      </header>
      <div className="dbh-gal-stream" ref={list}>
        {lines.length === 0 ? (
          <div className="dbh-hint">{props.snapshot.pending.activity ? '轨迹采集待接入' : '本轮暂无工具调用'}</div>
        ) : (
          lines.map((line, index) => (
            <TypingLine key={line.id} line={line} typing={index === last} caret={props.snapshot.running && index === last} />
          ))
        )}
      </div>
    </section>
  )
}

/** The modal itself. */
export function Gallery (props: { snapshot: HudSnapshot; onClose: () => void }): ReactElement {
  const dialog = useRef<HTMLDivElement | null>(null)
  const close = useRef<HTMLButtonElement | null>(null)

  // Escape closes; focus moves in on open and Tab cycles inside the dialog.
  useEffect(() => {
    close.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        props.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const scope = dialog.current
      if (scope === null) return
      const focusable = scope.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [props.onClose])

  return (
    <div className="dbh-gal-backdrop" onClick={props.onClose}>
      <div
        className="dbh-gal"
        role="dialog"
        aria-modal="true"
        aria-label="数据流"
        ref={dialog}
        onClick={event => event.stopPropagation()}
      >
        <header className="dbh-gal-head">
          <span className="dbh-mark" aria-hidden="true" />
          <span className="dbh-gal-title">数据流 · DATA FLOW</span>
          <span className="dbh-gal-window">{props.snapshot.history.length} 秒采样窗口</span>
          <button type="button" className="dbh-gal-close" aria-label="关闭数据流" onClick={props.onClose} ref={close}>
            ×
          </button>
        </header>
        <div className="dbh-gal-grid">
          <RhythmPane snapshot={props.snapshot} />
          <ContextPane snapshot={props.snapshot} />
          <StreamPane snapshot={props.snapshot} />
        </div>
      </div>
    </div>
  )
}
