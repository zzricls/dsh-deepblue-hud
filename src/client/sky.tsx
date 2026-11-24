import type { CSSProperties, ReactElement } from 'react'

/**
 * Slow, near-field star layer.
 *
 * The generated background (see `theme.ts`) is a static painting: a token value
 * cannot be animated, and animating the frame's own background is not ours to do.
 * So the *motion* lives in this thin layer instead — a few dozen specks inside our
 * overlay that drift and twinkle, composited above the app but below the panel.
 *
 * It is deliberately sparse and dim: these read as foreground dust in front of the
 * painted sky, which is what sells the parallax. `pointer-events: none` keeps the
 * whole layer out of the way of the UI underneath.
 */

/** One drifting speck. */
interface Star {
  id: number
  x: number
  y: number
  size: number
  drift: number
  twinkle: number
  delay: number
  dxp: number
  dyp: number
}

const STAR_COUNT = 46

/** Deterministic PRNG, so the layer does not reshuffle on every mount. */
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

function buildStars (): Star[] {
  const random = mulberry32(0xc0ffee)
  return Array.from({ length: STAR_COUNT }, (_, index) => ({
    id: index,
    x: random() * 100,
    y: random() * 100,
    size: random() < 0.15 ? 2 : 1 + random() * 0.8,
    // Non-multiple durations keep the field from ever moving in lockstep. The
    // range is tuned so the drift is plainly visible without reading as motion:
    // a full there-and-back cycle takes 4–10 s, i.e. roughly 2–4 px per second.
    drift: 4 + Math.round(random() * 6),
    twinkle: 3.5 + random() * 6,
    delay: random() * 14,
    dxp: 6 + random() * 16,
    dyp: -(6 + random() * 20),
  }))
}

const STARS = buildStars()

function styleFor (star: Star): CSSProperties {
  return {
    left: `${star.x.toFixed(2)}%`,
    top: `${star.y.toFixed(2)}%`,
    width: `${star.size.toFixed(2)}px`,
    height: `${star.size.toFixed(2)}px`,
    animationDuration: `${star.drift}s, ${star.twinkle}s`,
    animationDelay: `-${star.delay.toFixed(2)}s, -${(star.delay / 2).toFixed(2)}s`,
    '--dbh-dx': `${star.dxp.toFixed(1)}px`,
    '--dbh-dy': `${star.dyp.toFixed(1)}px`,
  } as CSSProperties
}

/** Frame-wide, non-interactive drifting star layer. */
export function StarVeil (): ReactElement {
  return (
    <div className="dbh-sky" aria-hidden="true">
      {STARS.map(star => (
        <span key={star.id} className="dbh-star" style={styleFor(star)} />
      ))}
    </div>
  )
}
