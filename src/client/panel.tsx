import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import {
  formatBytes,
  formatCost,
  formatPercent,
  formatRate,
  formatSpeed,
  formatTokens,
  ratio,
  severity,
} from './format'
import { Gallery } from './Gallery'
import { useHudSnapshot } from './source'
import { StarVeil } from './sky'
import { TypingLine } from './Typing'
import type { ActivityLine, HudSnapshot, SystemVitals, Tone } from './types'

/** Survives remounts within the page session: no storage service is injected. */
const memory = { collapsed: false }

/** Stagger between section entrances, inside the requested 30–50ms band. */
const STAGGER_MS = 40

/** Activity lines the panel shows; the gallery owns the full history. */
const PANEL_LINES = 4

/** Collapse duration; matches `--dbh-dur` so the two stay in step. */
const COLLAPSE_MS = 180

function prefersReducedMotion (): boolean {
  return typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ── primitives ───────────────────────────────────────────────────────── */

function Bar (props: { value: number; tone: Tone; label: string }): ReactElement {
  const clamped = Math.min(Math.max(props.value, 0), 1)
  return (
    <div
      className="dbh-bar"
      role="progressbar"
      aria-label={props.label}
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="dbh-fill" data-tone={props.tone} style={{ transform: `scaleX(${clamped})` }} />
    </div>
  )
}

function Row (props: { label: string; tone?: Tone; children: ReactNode }): ReactElement {
  return (
    <div className="dbh-row">
      <span className="dbh-k">{props.label}</span>
      <span className="dbh-v" data-tone={props.tone}>
        {props.children}
      </span>
    </div>
  )
}

/** Muted single line for a block with no source yet. */
function Hint (props: { children: ReactNode }): ReactElement {
  return <div className="dbh-hint">{props.children}</div>
}

function Section (props: { title: string; note?: string; index: number; children: ReactNode }): ReactElement {
  const style: CSSProperties = { animationDelay: `${props.index * STAGGER_MS}ms` }
  return (
    <section className="dbh-sec dbh-rise" style={style} aria-label={props.title}>
      <div className="dbh-sec-head">
        <span>{props.title}</span>
        {props.note === undefined ? null : <span className="dbh-sec-note">{props.note}</span>}
      </div>
      {props.children}
    </section>
  )
}

/* ── 会话经济 ─────────────────────────────────────────────────────────── */

const CONTEXT_LABEL: Record<Tone, string> = {
  accent: '上下文',
  success: '充裕',
  warn: '偏紧',
  error: '将满',
}

function SessionSection (props: { snapshot: HudSnapshot; index: number }): ReactElement {
  const { session, mode } = props.snapshot
  const hasContext = session.contextUsed !== null && session.contextMax !== null && session.contextMax > 0
  const used = hasContext ? ratio(session.contextUsed as number, session.contextMax as number) : 0
  const tone = severity(used, 0.7, 0.9)
  const left = hasContext ? Math.max((session.contextMax as number) - (session.contextUsed as number), 0) : 0

  return (
    <Section title="会话" note="经济" index={props.index}>
      {mode === 'idle' ? <Hint>等待会话</Hint> : null}
      <Row label="Tokens">
        {formatTokens(session.tokensIn)}
        <span className="dbh-u">入</span>
        <span className="dbh-u">/</span>
        {formatTokens(session.tokensOut)}
        <span className="dbh-u">出</span>
      </Row>
      <Row label="速度" tone="accent">
        {formatSpeed(session.speed)}
        <span className="dbh-u">tok/s</span>
      </Row>
      {session.cost === null ? null : <Row label="费用估算">{formatCost(session.cost)}</Row>}
      {hasContext ? (
        <div>
          <div className="dbh-row">
            <span className="dbh-k">上下文</span>
            <span className="dbh-v">
              {formatTokens(session.contextUsed as number)}
              <span className="dbh-u">/ {formatTokens(session.contextMax as number)}</span>
              <span className="dbh-u">·</span>
              {formatPercent(used * 100)}
            </span>
          </div>
          <Bar value={used} tone={tone} label={`上下文占用 ${formatPercent(used * 100)}`} />
          <div className="dbh-row" style={{ marginTop: 5 }}>
            <span className="dbh-chip" data-tone={tone}>
              {CONTEXT_LABEL[tone]}
            </span>
            <span className="dbh-sec-note">剩余 {formatTokens(left)}</span>
          </div>
        </div>
      ) : (
        <Hint>上下文待接入</Hint>
      )}
    </Section>
  )
}

/* ── 系统体征 ─────────────────────────────────────────────────────────── */

function NetworkValue (props: { network: NonNullable<SystemVitals['network']> }): ReactElement {
  return (
    <span className="dbh-net">
      <span>
        <i>↑</i>
        {formatRate(props.network.tx)}
      </span>
      <span>
        <i>↓</i>
        {formatRate(props.network.rx)}
      </span>
    </span>
  )
}

function SystemSection (props: { system: SystemVitals; pending: boolean; index: number }): ReactElement {
  const { system } = props
  const cpu = system.cpuPercent
  const mem = system.memory
  const disk = system.diskPercent
  const empty = cpu === null && mem === null && disk === null && system.network === null

  return (
    <Section title="系统" note="体征" index={props.index}>
      {cpu === null ? null : (
        <div>
          <Row label="CPU" tone={severity(cpu / 100, 0.7, 0.85)}>
            {formatPercent(cpu)}
          </Row>
          <Bar value={cpu / 100} tone={severity(cpu / 100, 0.7, 0.85)} label={`CPU 占用 ${formatPercent(cpu)}`} />
        </div>
      )}
      {mem === null ? null : (
        <div>
          <Row label="内存" tone={severity(mem.percent / 100, 0.75, 0.9)}>
            {formatPercent(mem.percent)}
            <span className="dbh-u">
              {formatBytes(mem.used)} / {formatBytes(mem.total)}
            </span>
          </Row>
          <Bar
            value={mem.percent / 100}
            tone={severity(mem.percent / 100, 0.75, 0.9)}
            label={`内存占用 ${formatPercent(mem.percent)}`}
          />
        </div>
      )}
      {disk === null ? null : (
        <div>
          <Row label="磁盘" tone={severity(disk / 100, 0.8, 0.92)}>
            {formatPercent(disk)}
          </Row>
          <Bar value={disk / 100} tone={severity(disk / 100, 0.8, 0.92)} label={`磁盘占用 ${formatPercent(disk)}`} />
        </div>
      )}
      {system.network === null ? null : (
        <Row label="网络">
          <NetworkValue network={system.network} />
        </Row>
      )}
      {empty ? <Hint>{props.pending ? '主机通道未接入' : '暂无数据'}</Hint> : null}
    </Section>
  )
}

/* ── 轨迹（活动流，打字机） ────────────────────────────────────────────── */

function ActivitySection (props: { lines: ActivityLine[]; pending: boolean; running: boolean; index: number }): ReactElement {
  const failed = props.lines.filter(line => line.status === 'error').length
  const note = props.lines.length === 0
    ? '暂无调用'
    : failed > 0
      ? `${props.lines.length} 条 · ${failed} 失败`
      : `${props.lines.length} 条`
  const visible = props.lines.slice(-PANEL_LINES)
  const lastIndex = visible.length - 1
  return (
    <Section title="轨迹" note={note} index={props.index}>
      {visible.length === 0 ? (
        <Hint>{props.pending ? '轨迹采集待接入' : '本轮暂无工具调用'}</Hint>
      ) : (
        <div className="dbh-tl">
          {visible.map((line, position) => (
            <TypingLine
              key={line.id}
              line={line}
              typing={position >= lastIndex - 1}
              caret={props.running && position === lastIndex}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

/* ── 面板 ─────────────────────────────────────────────────────────────── */

export function Cockpit (): ReactElement {
  const snapshot = useHudSnapshot()
  const [expanded, setExpanded] = useState(() => !memory.collapsed)
  const [closing, setClosing] = useState(false)
  const [gallery, setGallery] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      globalThis.clearTimeout(timer.current)
      timer.current = undefined
    }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const toggle = useCallback(() => {
    if (expanded) {
      memory.collapsed = true
      if (prefersReducedMotion()) {
        setClosing(false)
        setExpanded(false)
        return
      }
      setClosing(true)
      clearTimer()
      timer.current = globalThis.setTimeout(() => {
        timer.current = undefined
        setClosing(false)
        setExpanded(false)
      }, COLLAPSE_MS)
      return
    }
    clearTimer()
    memory.collapsed = false
    setClosing(false)
    setExpanded(true)
  }, [clearTimer, expanded])

  const { session } = snapshot
  const hasContext = session.contextUsed !== null && session.contextMax !== null && session.contextMax > 0
  const contextPercent = hasContext
    ? `${Math.round(ratio(session.contextUsed as number, session.contextMax as number) * 100)}%`
    : '—'
  const cpuPercent = snapshot.system.cpuPercent

  return (
    <>
      <StarVeil />
      <div className="dbh-panel" data-expanded={expanded ? 'true' : 'false'}>
        <div className="dbh-card">
          <button
            type="button"
            className="dbh-head"
            aria-expanded={expanded}
            aria-controls="dbh-body"
            aria-label={expanded ? 'Collapse cockpit panel' : 'Expand cockpit panel'}
            onClick={toggle}
          >
            <span className="dbh-mark" aria-hidden="true" />
            <span className="dbh-title">
              <em>Cockpit</em>
              {expanded ? ' · 深蓝' : null}
            </span>
            <span className="dbh-mini" aria-hidden="true">
              上下文 <b>{contextPercent}</b>
              <i>·</i>CPU <b>{cpuPercent === null ? '—' : `${Math.round(cpuPercent)}%`}</b>
            </span>
            <span className="dbh-chev" aria-hidden="true" />
          </button>
          {expanded ? (
            <div className="dbh-body" id="dbh-body" data-closing={closing ? 'true' : 'false'}>
              <SessionSection snapshot={snapshot} index={0} />
              <SystemSection system={snapshot.system} pending={snapshot.pending.system} index={1} />
              <ActivitySection
                lines={snapshot.activity}
                pending={snapshot.pending.activity}
                running={snapshot.running}
                index={2}
              />
              <div className="dbh-foot">
                <button type="button" className="dbh-foot-btn" onClick={() => setGallery(true)}>
                  数据流 · 展开
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {gallery ? <Gallery snapshot={snapshot} onClose={() => setGallery(false)} /> : null}
    </>
  )
}
