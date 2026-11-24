/**
 * Price table for the HUD's cost estimate.
 *
 * The Harness does not expose a per-session price: token accounting lives in the
 * `tokenUsage` projection (`uncachedInputTokens` / `cacheReadTokens` /
 * `cacheWriteTokens` / `outputTokens`), and provider pricing is owned by the LLM
 * route, which a Client plugin cannot read. So the estimate multiplies the real
 * token counts by whatever rates you put here.
 *
 * Leave the table empty and the cost row simply disappears — a missing number is
 * better than a made-up one. Fill it with your own plan's CNY rates (per million
 * tokens) to bring the row back.
 */

/** One model's rates, in CNY per million tokens. */
export interface PriceRow {
  /** Prompt tokens that missed the cache. */
  inputPerMillion: number
  /** Prompt tokens served from cache. */
  cacheReadPerMillion: number
  /** Prompt tokens written to cache. */
  cacheWritePerMillion: number
  /** Completion tokens. */
  outputPerMillion: number
}

/**
 * Rates by model id. Example (replace with your own plan's numbers):
 *
 * ```ts
 * 'deepseek-chat': {
 *   inputPerMillion: 2, cacheReadPerMillion: 0.5, cacheWritePerMillion: 2, outputPerMillion: 8,
 * },
 * ```
 */
export const PRICING: Record<string, PriceRow> = {}

/** Real token counts, as the `tokenUsage` projection reports them. */
export interface UsageTotals {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/**
 * Estimate spend in CNY, or `null` when no rate row matches.
 *
 * @param totals - cumulative token counts for the session.
 * @param model - model id from the session's model selection, when known.
 */
export function estimateCost(totals: UsageTotals, model: string | undefined): number | null {
  if (model === undefined) return null
  const row = PRICING[model]
  if (row === undefined) return null
  const million = 1_000_000
  return (
    (totals.uncachedInputTokens * row.inputPerMillion
      + totals.cacheReadTokens * row.cacheReadPerMillion
      + totals.cacheWriteTokens * row.cacheWritePerMillion
      + totals.outputTokens * row.outputPerMillion)
    / million
  )
}
