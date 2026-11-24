import type { ActivityLine, NodeStatus } from './types'

/**
 * Fold an unknown trajectory inspection onto the activity stream.
 *
 * `tool` lines are commands the agent ran; `think` lines are reasoning text. The
 * stream is flat on purpose: parallel calls are expressed as a group line plus
 * indented children, which types out the same way and needs no tree walker in the
 * view.
 */

/** Fields any plausible trajectory/call record may use, read tolerantly. */
interface UnknownRecord {
  [key: string]: unknown
}

function isRecord (value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pickString (record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

function pickNumber (record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

/** Map an arbitrary status-ish field onto the three dot colours. */
function toStatus (record: UnknownRecord): NodeStatus {
  const raw = (record.status ?? record.outcome ?? record.state ?? record.result) as unknown
  const text = typeof raw === 'string' ? raw : isRecord(raw) ? String(raw.kind ?? raw.type ?? '') : ''
  const lowered = text.toLowerCase()
  if (record.error !== undefined || record.errorCode !== undefined) return 'error'
  if (lowered.includes('error') || lowered.includes('fail') || lowered.includes('abort')) return 'error'
  if (lowered.includes('retry') || lowered.includes('warn') || lowered.includes('cancel')) return 'warn'
  if (lowered === '') {
    const ok = record.ok ?? record.success
    if (ok === false) return 'error'
  }
  return 'ok'
}

function formatMs (ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

const LABEL_KEYS = ['label', 'title', 'name', 'toolName', 'summary', 'kind', 'type']
const ID_KEYS = ['id', 'seq', 'callId', 'toolCallId']
const META_KEYS = ['durationMs', 'elapsedMs', 'ms', 'duration']
const TIME_KEYS = ['startedAt', 'startTime', 'start', 'time']
const END_KEYS = ['endedAt', 'endTime', 'end', 'completedAt']

function toLine (record: UnknownRecord, index: number, indent: number): ActivityLine | null {
  const text = pickString(record, LABEL_KEYS)
  if (text === undefined) return null
  const id = pickString(record, ID_KEYS) ?? String(pickNumber(record, ID_KEYS) ?? index)
  const duration = pickNumber(record, META_KEYS)
  const started = pickNumber(record, TIME_KEYS)
  const ended = pickNumber(record, END_KEYS)
  const derived = duration ?? (started !== undefined && ended !== undefined ? ended - started : undefined)
  const retry = pickNumber(record, ['retry', 'attempt'])
  const meta = derived !== undefined
    ? formatMs(derived)
    : retry !== undefined && retry > 0
      ? `retry ${retry}`
      : undefined
  return {
    id: `${index}:${id}`,
    kind: 'tool',
    text,
    status: toStatus(record),
    ...(meta === undefined ? {} : { meta }),
    ...(indent === 0 ? {} : { indent }),
  }
}

/** Read a list field out of an unknown inspection object. */
function arrayField (inspection: unknown, keys: string[]): UnknownRecord[] {
  if (!isRecord(inspection)) return []
  for (const key of keys) {
    const value = inspection[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

/**
 * Fold the trajectory inspection onto the activity stream.
 *
 * Written defensively: the inspection is a client-internal shape that differs
 * between releases, so every field is read by candidate name and anything
 * unrecognisable is skipped rather than rendered as noise.
 *
 * @param inspection - whatever `useTrajectory((snapshot) => snapshot)` returned.
 * @param running - whether the agent is currently working.
 * @param limit - how many trailing lines to keep.
 * @returns the stream, oldest first.
 */
export function mapActivity (
  inspection: unknown,
  running: boolean,
  limit = 9,
): ActivityLine[] {
  const lines: ActivityLine[] = []

  // Reasoning text, when the inspection carries any (live assistant deltas).
  if (isRecord(inspection)) {
    const partial = inspection.partial
    const thought = pickString(
      isRecord(partial) ? partial : inspection,
      ['reasoning', 'reasoningText', 'thought', 'thinking'],
    )
    if (thought !== undefined) {
      lines.push({ id: 'think', kind: 'think', text: thought.slice(-320), status: 'ok' })
    }
  }

  const runningCalls = arrayField(inspection, ['runningCalls', 'activeCalls'])
  for (const [index, call] of runningCalls.entries()) {
    const line = toLine(call, index, 0)
    if (line !== null) lines.push({ ...line, id: `run:${line.id}`, status: running ? 'warn' : line.status })
  }

  const nodes = arrayField(inspection, ['eventNodes', 'nodes', 'events'])
  const mapped: ActivityLine[] = []
  for (const [index, node] of nodes.entries()) {
    const line = toLine(node, index, 0)
    if (line !== null) mapped.push(line)
  }
  lines.push(...mapped.slice(-limit))

  return lines.slice(-limit)
}
