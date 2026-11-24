import type { Tone } from './types'

/** Clamp `value` into `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Format an integer with thin thousands separators; compact above 10k. */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}k`
  return Math.round(value).toLocaleString('en-US')
}

/** Format a plain percentage, no decimals. */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '—'
  return `${Math.round(clamp(percent, 0, 100))}%`
}

/** Bytes → `21.4 GB` style, one decimal. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Bytes per second → `1.9 MB/s`. */
export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) return '—'
  return `${formatBytes(bytesPerSecond)}/s`
}

/** CNY amount, always four decimals as specified. */
export function formatCost(cny: number): string {
  if (!Number.isFinite(cny)) return '¥—'
  return `¥${cny.toFixed(4)}`
}

/** Tokens per second, one decimal. */
export function formatSpeed(tokensPerSecond: number): string {
  if (!Number.isFinite(tokensPerSecond)) return '—'
  return tokensPerSecond.toFixed(1)
}

/**
 * Map a ratio to a severity tone.
 *
 * @param ratio - current fraction of the ceiling, `0..1`.
 * @param warn - first threshold; at or above it the value is yellow.
 * @param danger - second threshold; at or above it the value is red.
 */
export function severity(ratio: number, warn: number, danger: number): Tone {
  if (!Number.isFinite(ratio)) return 'accent'
  if (ratio >= danger) return 'error'
  if (ratio >= warn) return 'warn'
  return 'success'
}

/** Fraction `used / total`, guarded against a zero total. */
export function ratio(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0
  return clamp(used / total, 0, 1)
}
