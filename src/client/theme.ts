import type { ThemeTokenPair } from './context'

/**
 * Layer identity. One layer per source: unload (or a re-apply) removes exactly
 * this layer, which is what makes "uninstall restores the UI" true.
 */
export const OVERRIDE_SOURCE = 'dsh-deepblue-hud'

/**
 * Deep-blue palette as a theme token layer.
 *
 * Only **real** alias tokens are listed — a misspelled name is written to
 * `<body>` but matches no CSS variable, so the theme degrades silently. Names
 * verified against the 0.2.x token directory (`--dsw-alias-*`, 57 names, plus
 * `--dsw-specific-sidebar-fill`).
 *
 * The composition follows the brief: ~60% deep navy surfaces, ~30% layered
 * transitions, ~10% tidal-blue accent. Both schemes carry the same values: this
 * is a deliberate re-skin, not a light-mode theme, and the `{ light, dark }`
 * pair is still required by the runtime (a bare string throws).
 */
const pair = (value: string): ThemeTokenPair => ({ light: value, dark: value })

/**
 * Starfield background (experiment).
 *
 * This token is a **background value**, not a color: the app frame and the centre
 * column both paint `background: var(--dsw-alias-bg-base)`, so a layered gradient
 * here becomes a real, full-page starfield behind every panel. `fixed` attachment
 * pins every layer to the viewport, which is what keeps several elements painting
 * the same token seamless.
 *
 * The stars are generated, not tiled: one non-repeating gradient layer per star,
 * positioned by a seeded PRNG so the sky is irregular and identical across
 * reloads. (Tiling was the earlier version; with one star per tile the grid was
 * visible no matter how the tile sizes were chosen.)
 *
 * Known collateral (accept or revert, it is one constant): the few consumers that
 * need a *color* — `background-color:` and `color-mix(… var(--…bg-base) …)` — are
 * invalidated, most visibly the composer seat's fade-to-background.
 */

/** Deterministic PRNG so the sky does not reshuffle on every reload. */
function mulberry32 (seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAR_COUNT = 90

function buildStars (): string {
  const random = mulberry32(0x5eed1337)
  const layers: string[] = [
    // tidal haze along the top edge, and a soft glow bottom-left for depth
    'radial-gradient(120% 70% at 50% -10%, rgb(56 189 248 / .07), transparent 62%) 0 0 / 100% 100% fixed no-repeat',
    'radial-gradient(70% 50% at 8% 105%, rgb(56 189 248 / .05), transparent 70%) 0 0 / 100% 100% fixed no-repeat',
  ]
  for (let index = 0; index < STAR_COUNT; index += 1) {
    const x = (random() * 100).toFixed(2)
    const y = (random() * 100).toFixed(2)
    // most stars are tiny; a few are brighter, which is what keeps it from
    // reading as uniform noise
    const size = (random() < 0.12 ? 1.5 + random() * 1.1 : 0.7 + random() * 0.7).toFixed(2)
    const alpha = (0.22 + random() * 0.58).toFixed(2)
    const tint = random() < 0.2 ? '56 189 248' : '226 234 245'
    layers.push(
      `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgb(${tint} / ${alpha}) 50%, transparent 52%) 0 0 / 100% 100% fixed no-repeat`,
    )
  }
  return layers.join(', ')
}

const STARFIELD = buildStars()

/** Flat base colour; flip `useStarfield` to `false` to go back to this. */
const BASE_COLOR = '#0a1524'

/** One-line kill switch for the starfield experiment. */
const useStarfield = true

const BASE_SURFACE = useStarfield ? `${STARFIELD}, ${BASE_COLOR}` : BASE_COLOR

export const DEEP_BLUE: Record<string, ThemeTokenPair> = {
  // ── 60%: base surfaces ────────────────────────────────────────────────
  '--dsw-alias-bg-base': pair(BASE_SURFACE),
  '--dsw-alias-bg-module-platform': pair('#08111d'),
  '--dsw-alias-bg-mask-1': pair('rgb(3 8 15 / 0.66)'),
  '--dsw-specific-sidebar-fill': pair('#081320'),

  // ── 30%: stacked layers ───────────────────────────────────────────────
  '--dsw-alias-bg-layer-1': pair('#101e31'),
  '--dsw-alias-bg-layer-2': pair('#16283f'),
  '--dsw-alias-bg-layer-3': pair('#1c3450'),
  '--dsw-alias-bg-layer-4': pair('#223d5d'),
  '--dsw-alias-bg-overlay': pair('#0e1b2c'),
  '--dsw-alias-interactive-bg-hover': pair('#16283f'),
  '--dsw-alias-interactive-bg-active': pair('#1c3450'),
  '--dsw-alias-menu-group-header-fill': pair('#0d1a2b'),
  '--dsw-alias-markdown-code-block': pair('#0c1826'),
  '--dsw-alias-markdown-inline-code': pair('#16283f'),

  // ── text ──────────────────────────────────────────────────────────────
  '--dsw-alias-label-primary': pair('#e2eaf5'),
  '--dsw-alias-label-secondary': pair('#9db3d1'),
  '--dsw-alias-label-tertiary': pair('#7a92b3'),
  '--dsw-alias-label-caption': pair('#66799a'),
  '--dsw-alias-label-dimmed': pair('#556b8c'),
  '--dsw-alias-label-primary-foreground': pair('#06111d'),
  '--dsw-alias-label-error': pair('#ffa1a1'),

  // ── borders ───────────────────────────────────────────────────────────
  '--dsw-alias-border-l1': pair('#17293f'),
  '--dsw-alias-border-l2': pair('#1f3754'),
  '--dsw-alias-border-l3': pair('#294669'),
  '--dsw-alias-border-l4': pair('#34577f'),

  // ── 10%: tidal-blue accent + state colors ────────────────────────────
  '--dsw-alias-brand-primary': pair('#38bdf8'),
  '--dsw-alias-state-business-primary': pair('#38bdf8'),
  '--dsw-alias-link': pair('#7dd3fc'),
  '--dsw-alias-state-success-primary': pair('#34d399'),
  '--dsw-alias-state-success-tertiary': pair('#0f3d31'),
  '--dsw-alias-state-warn-primary': pair('#fbbf24'),
  '--dsw-alias-state-warn-label': pair('#fbbf24'),
  '--dsw-alias-state-warn-tertiary': pair('#3f3320'),
  '--dsw-alias-state-error-primary': pair('#f87171'),
  '--dsw-alias-state-idle-primary': pair('#5b7396'),

  // ── chrome: buttons, toasts, scrollbars ──────────────────────────────
  '--dsw-alias-button-primary-fill': pair('#38bdf8'),
  '--dsw-alias-button-primary-hover': pair('#5cc9f9'),
  '--dsw-alias-button-ghost-active-fill': pair('#1c3450'),
  '--dsw-alias-button-ghost-active-border': pair('#294669'),
  '--dsw-alias-button-tool-bar-fill': pair('#101e31'),
  '--dsw-alias-button-tool-bar-hover': pair('#16283f'),
  '--dsw-alias-toast-bg': pair('#16283f'),
  '--dsw-alias-toast-label': pair('#e2eaf5'),
  '--dsw-alias-tooltip-bg': pair('#16283f'),
  '--dsw-alias-tooltip-key-bg': pair('#1c3450'),
  '--dsw-alias-scrollbar-bg-l2': pair('#1f3754'),
  '--dsw-alias-scrollbar-hover-l2': pair('#294669'),
}
