import { useState } from 'react'
import type { ReactElement } from 'react'
import { Markdown } from './markdown'
import { useTyped } from './Typing'

/**
 * Trial: take over the `assistant-step` Chat node renderer.
 *
 * Why a whole step and not the two block rows: `conversation.chat.node` is a
 * keyed slot keyed by `ChatNodeKind`, and the shipped chat defines the assistant
 * step as one node (`kind: "assistant-step"`) whose *blocks* — reasoning, text,
 * tool-call, image — are plain objects rendered inside it. There is no seat per
 * block, so the only way to type the reasoning text in the transcript is to
 * replace the step renderer.
 *
 * That means this file also owns rendering everything else in the step: the body
 * goes through the local Markdown renderer, reasoning is typed and collapsible,
 * and a tool call is a compact row that expands to its arguments and, when the
 * node carries it, its output. Set `TAKE_OVER_STEP` to `false` in `index.ts` to
 * hand the step back to the shipped renderer.
 */

/** One rendered block inside a step. */
interface StepBlock {
  kind: string
  text?: string
  name?: string
  argsRaw?: string
  callId?: string
}

/** How deep the props scan walks before giving up. */
const MAX_DEPTH = 7

const BLOCK_KINDS = new Set(['reasoning', 'text', 'tool-call', 'image', 'other'])

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBlock (value: unknown): value is StepBlock {
  if (!isRecord(value)) return false
  const kind = value.kind
  return typeof kind === 'string' && BLOCK_KINDS.has(kind)
}

/**
 * Find the step's blocks in whatever the renderer receives.
 *
 * The props shape is a client-internal detail, so instead of hard-coding a path
 * this walks the tree and takes the first array (or single object) whose members
 * look like assistant blocks. A wrong guess therefore renders the fallback note
 * rather than throwing inside the transcript.
 */
function findBlocks (input: unknown, depth = 0): StepBlock[] {
  if (depth > MAX_DEPTH || !isRecord(input)) return []
  for (const value of Object.values(input)) {
    if (Array.isArray(value)) {
      const blocks = value.filter(isBlock)
      if (blocks.length > 0) return blocks
    }
    if (isBlock(value)) return [value]
    if (isRecord(value)) {
      const nested = findBlocks(value, depth + 1)
      if (nested.length > 0) return nested
    }
  }
  return []
}

/** Text-ish payload of a record, for tool output. */
function pickText (record: Record<string, unknown>): string | null {
  for (const key of ['output', 'result', 'text', 'content', 'preview', 'summary']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (Array.isArray(value)) {
      const joined = value
        .map(item => (isRecord(item) && typeof item.text === 'string' ? item.text : ''))
        .filter(text => text !== '')
        .join('\n')
      if (joined !== '') return joined
    }
  }
  return null
}

/**
 * Look for the output of one tool call anywhere in the node.
 *
 * The inspected call's result may live beside the block, in a sibling map, or not
 * at all — so this returns `null` more often than not, and the row falls back to
 * the host's own inspector instead of inventing output.
 *
 * @param input - node/props tree.
 * @param callId - id of the call to find.
 * @returns output text, or `null`.
 */
export function findToolResult (input: unknown, callId: string, depth = 0): string | null {
  if (depth > MAX_DEPTH || callId === '' || !isRecord(input)) return null
  // Check the node itself first: results often arrive as array items, and the
  // recursive walk below only inspects *values*, never the record it was handed.
  const ownId = input.callId ?? input.toolCallId ?? input.id
  if (ownId !== undefined && String(ownId) === callId) {
    const text = pickText(input)
    if (text !== null) return text
  }
  for (const value of Object.values(input)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findToolResult(item, callId, depth + 1)
        if (found !== null) return found
      }
      continue
    }
    if (!isRecord(value)) continue
    const id = value.callId ?? value.toolCallId ?? value.id
    if (id !== undefined && String(id) === callId) {
      const text = pickText(value)
      if (text !== null) return text
    }
    const nested = findToolResult(value, callId, depth + 1)
    if (nested !== null) return nested
  }
  return null
}

/** The host's "inspect this call" callback, when the node provides one. */
function findInspect (props: unknown): ((callId: string) => void) | undefined {
  if (!isRecord(props)) return undefined
  const direct = props.inspectCall
  if (typeof direct === 'function') return direct as (callId: string) => void
  for (const value of Object.values(props)) {
    if (isRecord(value) && typeof value.inspectCall === 'function') {
      return value.inspectCall as (callId: string) => void
    }
  }
  return undefined
}

/** Pretty-print raw arguments when they are JSON, else leave them alone. */
export function prettyArgs (raw: string | undefined): string {
  if (raw === undefined) return ''
  try {
    const parsed: unknown = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

/** First line of a collapsed thought, so a folded block still says something. */
function previewOf (text: string): string {
  const first = text.replace(/\s+/g, ' ').trim()
  return first.length > 64 ? `${first.slice(0, 63)}…` : first
}

/**
 * Reasoning text: typed out, collapsible.
 *
 * Collapsed by default for anything that is not the step's newest block — a long
 * thought is the thing people scroll past, not the thing they read twice. The
 * newest block starts open so the typing is visible while it streams, and folds
 * itself once the answer body follows it.
 */
function Reasoning (props: { text: string; defaultOpen: boolean }): ReactElement {
  const [open, setOpen] = useState(props.defaultOpen)
  const prefersReduced = typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Only type while it is visible; a collapsed block costs nothing.
  const shown = useTyped(open ? props.text : '', !prefersReduced)
  const characters = props.text.replace(/\s/g, '').length
  return (
    <div className="dbh-think" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="dbh-think-head"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="dbh-think-chev" aria-hidden="true" />
        <span className="dbh-think-verb">思考</span>
        <span className="dbh-think-meta">{characters} 字</span>
      </button>
      {open ? (
        <div className="dbh-think-body">
          {shown}
          {shown.length < props.text.length ? <span className="dbh-caret" aria-hidden="true" /> : null}
        </div>
      ) : (
        <div className="dbh-think-preview">{previewOf(props.text)}</div>
      )}
    </div>
  )
}

/** Arguments summary for a collapsed tool row. */
function argsSummary (raw: string | undefined): string {
  if (raw === undefined) return ''
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat.length > 72 ? `${flat.slice(0, 71)}…` : flat
}

/**
 * One tool call: a compact row that expands to its arguments and output.
 *
 * The output is shown only when the node actually carries it; otherwise the row
 * offers the host's inspector (`inspectCall`), which is the sanctioned way to see
 * a call's full input and output without re-implementing the tool view.
 */
function ToolRow (props: {
  block: StepBlock
  result: string | null
  inspect: ((callId: string) => void) | undefined
}): ReactElement {
  const [open, setOpen] = useState(false)
  const callId = props.block.callId ?? ''
  const args = prettyArgs(props.block.argsRaw)
  return (
    <div className="dbh-step-tool" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="dbh-step-tool-head"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="dbh-step-dot" aria-hidden="true" />
        <span className="dbh-step-tool-name">{props.block.name ?? 'tool'}</span>
        <span className="dbh-step-tool-args">{argsSummary(props.block.argsRaw)}</span>
        <span className="dbh-step-tool-chev" aria-hidden="true" />
      </button>
      {open ? (
        <div className="dbh-step-tool-body">
          {args === '' ? null : <pre className="dbh-step-tool-pre">{args}</pre>}
          {props.result === null ? null : <pre className="dbh-step-tool-pre dbh-step-tool-out">{props.result}</pre>}
          {props.result === null && props.inspect !== undefined && callId !== '' ? (
            <button type="button" className="dbh-step-tool-link" onClick={() => props.inspect?.(callId)}>
              在调用详情中查看输出 →
            </button>
          ) : null}
          {props.result === null && props.inspect === undefined ? (
            <div className="dbh-step-tool-note">此步未携带输出，宿主也未提供调用详情入口</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function renderBlock (block: StepBlock, index: number, lastIndex: number, props: unknown): ReactElement | null {
  if (block.kind === 'reasoning') {
    return block.text === undefined || block.text === '' ? null : (
      <Reasoning key={index} text={block.text} defaultOpen={index === lastIndex} />
    )
  }
  if (block.kind === 'text') {
    return block.text === undefined || block.text === '' ? null : (
      <Markdown key={index} text={block.text} />
    )
  }
  if (block.kind === 'tool-call') {
    const callId = block.callId ?? ''
    return (
      <ToolRow
        key={index}
        block={block}
        result={callId === '' ? null : findToolResult(props, callId)}
        inspect={findInspect(props)}
      />
    )
  }
  // image / other: nothing in the trial.
  return null
}

/**
 * Replacement renderer for the shipped `assistant-step` node.
 *
 * Every failure mode lands on the visible note, never on a silent blank: a step
 * that the plugin cannot read must say so, or the transcript would look like the
 * message vanished.
 */
export function AssistantStepView (props: unknown): ReactElement {
  try {
    const blocks = findBlocks(props)
    if (blocks.length === 0) {
      return <div className="dbh-step-note">此步由 Cockpit 接管，但结构未识别（详见控制台）</div>
    }
    return (
      <div className="dbh-step">
        {blocks.map((block, index) => renderBlock(block, index, blocks.length - 1, props))}
      </div>
    )
  } catch {
    return <div className="dbh-step-note">Cockpit 接管渲染失败，已跳过此步</div>
  }
}
