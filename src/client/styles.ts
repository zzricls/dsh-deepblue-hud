/**
 * Panel stylesheet, injected once through `ctx.effect` and tagged with
 * `data-plugin-css` so unload removes it again.
 *
 * Rules followed here:
 * - every color is a `--dsw-alias-*` / `--dsw-specific-*` token (shadows are
 *   `color-mix` of the base token, never a literal black);
 * - animation touches only `opacity` and `transform` — bars animate with
 *   `scaleX`, collapse with `translateY`, and no layout property transitions;
 * - `prefers-reduced-motion: reduce` removes every animation and transition.
 */
export const PANEL_CSS = String.raw`
.dbh-panel {
  --dbh-dur: 180ms;
  --dbh-dur-enter: 320ms;
  --dbh-dur-slow: 460ms;
  --dbh-ease: cubic-bezier(.22,.61,.36,1);
  position: absolute;
  right: 16px;
  /* Clears the composer band: the composer seat spans the column bottom, and a
     corner dock would sit on top of it. Tunable via --dbh-dock-bottom. */
  bottom: var(--dbh-dock-bottom, 168px);
  z-index: 1;
  width: 296px;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
  box-sizing: border-box;
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 12px;
  line-height: 1.45;
  color: var(--dsw-alias-label-primary);
  -webkit-font-smoothing: antialiased;
}

.dbh-panel *,
.dbh-panel *::before,
.dbh-panel *::after { box-sizing: border-box; }

.dbh-card {
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow:
    0 20px 48px -22px color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent),
    0 2px 10px -6px color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent);
}

/* ── header ─────────────────────────────────────────────────────────── */
.dbh-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 9px 11px;
  border: 0;
  border-radius: 0;
  background: linear-gradient(180deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1));
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-head:hover { background: linear-gradient(180deg, var(--dsw-alias-bg-layer-3), var(--dsw-alias-bg-layer-1)); }
.dbh-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }

.dbh-mark {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
  transform: rotate(45deg);
  animation: dbh-pulse 2.6s ease-in-out infinite;
}

.dbh-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}
.dbh-title em {
  font-style: normal;
  color: var(--dsw-alias-brand-primary);
}

.dbh-mini {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
  white-space: nowrap;
}
.dbh-mini b { font-weight: 600; color: var(--dsw-alias-label-secondary); }
.dbh-mini i { font-style: normal; color: var(--dsw-alias-border-l4); }
.dbh-panel[data-expanded="true"] .dbh-mini { display: none; }

/* muted line for a block whose source is not wired yet */
.dbh-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
}
.dbh-hint::before {
  content: "";
  flex: none;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}

.dbh-chev {
  flex: none;
  width: 9px;
  height: 9px;
  margin-bottom: 3px;
  border-right: 1.5px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.5px solid var(--dsw-alias-label-tertiary);
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-panel[data-expanded="true"] .dbh-chev { transform: rotate(-135deg); }

/* ── body ───────────────────────────────────────────────────────────── */
.dbh-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: min(60vh, 520px);
  padding: 10px 11px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 44px),
    var(--dsw-alias-bg-layer-1);
}
.dbh-body[data-closing="true"] {
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;
  transition: opacity var(--dbh-dur) var(--dbh-ease), transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-body::-webkit-scrollbar { width: 6px; }
.dbh-body::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--dsw-alias-scrollbar-bg-l2); }
.dbh-body::-webkit-scrollbar-thumb:hover { background: var(--dsw-alias-scrollbar-hover-l2); }

/* ── section frame ──────────────────────────────────────────────────── */
.dbh-sec { display: flex; flex-direction: column; gap: 5px; }
.dbh-sec + .dbh-sec {
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dbh-sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dbh-sec-note {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: none;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}

/* ── rows and values ────────────────────────────────────────────────── */
.dbh-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.dbh-k { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.dbh-v {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  text-align: right;
  white-space: nowrap;
}
.dbh-v[data-tone="accent"] { color: var(--dsw-alias-brand-primary); }
.dbh-v[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dbh-v[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dbh-v[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dbh-u {
  margin-left: 3px;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .02em;
  color: var(--dsw-alias-label-caption);
}

/* ── bars ───────────────────────────────────────────────────────────── */
.dbh-bar {
  position: relative;
  height: 5px;
  margin-top: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3);
}
.dbh-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-border-l1) 80%, transparent);
}
.dbh-fill {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  transform-origin: 0 50%;
  background: var(--dsw-alias-brand-primary);
  /* Only the fill *shape* animates; a threshold change flips the color instantly,
     because a status change should read as a state, not as a fade. */
  transition: transform var(--dbh-dur-slow) var(--dbh-ease);
}
.dbh-fill[data-tone="success"] { background: var(--dsw-alias-state-success-primary); }
.dbh-fill[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary); }
.dbh-fill[data-tone="error"] { background: var(--dsw-alias-state-error-primary); }

/* ── chips ──────────────────────────────────────────────────────────── */
.dbh-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dbh-chip[data-tone="success"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
.dbh-chip[data-tone="warn"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.dbh-chip[data-tone="error"] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 46%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);
  color: var(--dsw-alias-state-error-primary);
}

/* ── network pair ───────────────────────────────────────────────────── */
.dbh-net { display: inline-flex; align-items: baseline; gap: 8px; }
.dbh-net span { font-variant-numeric: tabular-nums; }
.dbh-net i {
  margin-right: 2px;
  font-style: normal;
  font-size: 9.5px;
  color: var(--dsw-alias-label-caption);
}

/* ── trajectory ─────────────────────────────────────────────────────── */
.dbh-tl { display: flex; flex-direction: column; }
.dbh-node {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
}
.dbh-node::before {
  content: "";
  position: absolute;
  top: 11px;
  bottom: -11px;
  left: 4.5px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}
.dbh-node:last-child::before { display: none; }
.dbh-dot {
  position: relative;
  z-index: 1;
  flex: none;
  width: 6px;
  height: 6px;
  margin: 5px 0 0 2px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
  box-shadow: 0 0 0 3px var(--dsw-alias-bg-layer-1);
}
.dbh-node[data-status="ok"] .dbh-dot { background: var(--dsw-alias-brand-primary); }
.dbh-node[data-status="warn"] .dbh-dot { background: var(--dsw-alias-state-warn-primary); }
.dbh-node[data-status="error"] .dbh-dot { background: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="error"] .dbh-dot {
  box-shadow:
    0 0 0 3px var(--dsw-alias-bg-layer-1),
    0 0 0 5px color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, transparent);
}
.dbh-node-body { flex: 1 1 auto; min-width: 0; }
.dbh-node-label {
  overflow: hidden;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-node[data-status="error"] .dbh-node-label { color: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="warn"] .dbh-node-label { color: var(--dsw-alias-label-primary); }
.dbh-node-meta {
  flex: none;
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
}
.dbh-node[data-status="error"] .dbh-node-meta { color: var(--dsw-alias-state-error-primary); }
.dbh-node[data-status="warn"] .dbh-node-meta { color: var(--dsw-alias-state-warn-primary); }

/* typewriter caret: the only text-mutating motion in the plugin */
.dbh-node-label { contain: layout style; }
.dbh-caret {
  display: inline-block;
  width: 5px;
  height: 10px;
  margin-left: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-brand-primary);
  vertical-align: -1px;
  animation: dbh-blink 1.05s steps(1, end) infinite;
}

/* ── sky: near-field drifting stars ─────────────────────────────────── */
/* Frame-wide, behind the panel, and never in the way of the UI underneath.
   Doubled class keeps pointer-events: none ahead of the host rule that hands
   every overlay entry pointer events. */
.dbh-sky.dbh-sky {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.dbh-star {
  position: absolute;
  border-radius: 50%;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 82%, transparent);
  box-shadow: 0 0 4px color-mix(in srgb, var(--dsw-alias-brand-primary) 34%, transparent);
  animation-name: dbh-drift, dbh-twinkle;
  animation-timing-function: ease-in-out, ease-in-out;
  animation-iteration-count: infinite, infinite;
  will-change: transform, opacity;
}

/* ── motion ─────────────────────────────────────────────────────────── */
@keyframes dbh-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes dbh-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .38; }
}
@keyframes dbh-drift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(var(--dbh-dx, 10px), var(--dbh-dy, -12px), 0); }
}
@keyframes dbh-twinkle {
  0%, 100% { opacity: .25; }
  50% { opacity: .95; }
}
@keyframes dbh-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.dbh-rise { animation: dbh-rise var(--dbh-dur-enter) var(--dbh-ease) both; }

@media (prefers-reduced-motion: reduce) {
  .dbh-panel,
  .dbh-panel *,
  .dbh-panel *::before,
  .dbh-panel *::after,
  .dbh-sky,
  .dbh-sky *,
  .dbh-step,
  .dbh-step *,
  .dbh-gal,
  .dbh-gal *,
  .dbh-gal-backdrop {
    animation: none !important;
    transition: none !important;
  }
  .dbh-body[data-closing="true"] { opacity: 0; transform: none; }
  /* Reduced motion keeps the sky, just still. */
  .dbh-star { opacity: .55; }
}

@media (max-width: 960px) {
  .dbh-panel { right: 10px; width: 264px; bottom: var(--dbh-dock-bottom, 150px); }
}

/* ── markdown body (assistant text inside the takeover) ─────────────── */
.dbh-md { display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.65; }
.dbh-md > :first-child { margin-top: 0; }
.dbh-md > :last-child { margin-bottom: 0; }
.dbh-md-p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.dbh-md-h {
  margin: 4px 0 0;
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: .01em;
  color: var(--dsw-alias-label-primary);
}
.dbh-md-code {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--dsw-alias-markdown-inline-code);
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}
.dbh-md-pre {
  position: relative;
  margin: 0;
  padding: 9px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-markdown-code-block);
  overflow-x: auto;
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--dsw-alias-label-primary);
  white-space: pre;
}
.dbh-md-lang {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 9.5px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-caption);
}
.dbh-md-quote {
  margin: 0;
  padding: 2px 0 2px 10px;
  border-left: 2px solid var(--dsw-alias-border-l3);
  color: var(--dsw-alias-label-secondary);
}
.dbh-md-list { margin: 0; padding-left: 18px; }
.dbh-md-list li { margin: 2px 0; }
.dbh-md-rule { margin: 2px 0; border: 0; border-top: 1px solid var(--dsw-alias-border-l2); }
.dbh-md-a { color: var(--dsw-alias-link); text-decoration: underline; text-underline-offset: 2px; }


/* ── footer entry to the gallery ────────────────────────────────────── */
.dbh-foot { display: flex; justify-content: flex-end; padding-top: 2px; }
.dbh-foot-btn {
  padding: 3px 9px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  letter-spacing: .04em;
  cursor: pointer;
  appearance: none;
}
.dbh-foot-btn:hover { border-color: var(--dsw-alias-border-l3); color: var(--dsw-alias-label-primary); }
.dbh-foot-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }

/* ── data-flow gallery ──────────────────────────────────────────────── */
.dbh-gal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  pointer-events: auto;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
  animation: dbh-gal-fade var(--dbh-dur) var(--dbh-ease) both;
}
.dbh-gal {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  height: min(680px, 100%);
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow:
    0 32px 80px -32px color-mix(in srgb, var(--dsw-alias-bg-base) 95%, transparent),
    0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  font-family: var(--dsw-font-family, system-ui, sans-serif);
  color: var(--dsw-alias-label-primary);
  animation: dbh-gal-pop var(--dbh-dur-enter) var(--dbh-ease) both;
}
.dbh-gal-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: linear-gradient(180deg, var(--dsw-alias-bg-layer-2), var(--dsw-alias-bg-layer-1));
}
.dbh-gal-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.dbh-gal-close {
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  appearance: none;
}
.dbh-gal-close:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.dbh-gal-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dbh-gal-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 1px;
  background: var(--dsw-alias-border-l1);
}
.dbh-gal-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px 14px;
  background: var(--dsw-alias-bg-layer-1);
}
.dbh-gal-pane-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}
.dbh-gal-pane-note {
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: none;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.dbh-gal-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  flex: 1;
  min-height: 90px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dbh-gal-bar {
  position: relative;
  flex: 1 1 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  transform-origin: 50% 100%;
}
.dbh-gal-bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 2px 2px 0 0;
  transform-origin: 50% 100%;
  transition: transform var(--dbh-dur-slow) var(--dbh-ease);
  /* input below the split, output above it */
  background: linear-gradient(
    to top,
    var(--dsw-alias-brand-primary) 0,
    var(--dsw-alias-brand-primary) var(--dbh-split, 50%),
    var(--dsw-alias-state-business-primary) var(--dbh-split, 50%),
    var(--dsw-alias-state-business-primary) 100%
  );
}
.dbh-gal-legend {
  display: flex;
  gap: 12px;
  font-size: 10px;
  color: var(--dsw-alias-label-caption);
}
.dbh-gal-legend span { display: inline-flex; align-items: center; gap: 5px; }
.dbh-gal-key { width: 8px; height: 8px; border-radius: 2px; }
.dbh-gal-key[data-kind="in"] { background: var(--dsw-alias-brand-primary); }
.dbh-gal-key[data-kind="out"] { background: var(--dsw-alias-state-business-primary); }
.dbh-gal-curve {
  position: relative;
  flex: 1;
  min-height: 120px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}
.dbh-gal-curve svg { width: 100%; height: 100%; display: block; }
.dbh-gal-line {
  fill: none;
  stroke: var(--dsw-alias-brand-primary);
  stroke-width: 1.6;
  vector-effect: non-scaling-stroke;
}
.dbh-gal-th { stroke-width: 1; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.dbh-gal-th[data-tone="warn"] { stroke: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent); }
.dbh-gal-th[data-tone="error"] { stroke: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, transparent); }
.dbh-gal-th-labels {
  position: absolute;
  top: 4px;
  left: 8px;
  display: flex;
  gap: 8px;
  font-size: 9px;
  color: var(--dsw-alias-label-caption);
}
.dbh-gal-th-labels span:first-child { color: var(--dsw-alias-state-error-primary); }
.dbh-gal-th-labels span:last-child { color: var(--dsw-alias-state-warn-primary); }
.dbh-gal-chip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 80%, transparent);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dbh-gal-chip[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dbh-gal-chip[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dbh-gal-chip[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dbh-gal-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  overscroll-behavior: contain;
}
.dbh-gal-stream::-webkit-scrollbar { width: 6px; }
.dbh-gal-stream::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--dsw-alias-scrollbar-bg-l2); }
@keyframes dbh-gal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes dbh-gal-pop {
  from { opacity: 0; transform: translateY(12px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}


/* gallery stats strip */
.dbh-gal-stats {
  display: flex;
  gap: 14px;
  padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 10px;
  color: var(--dsw-alias-label-caption);
  letter-spacing: .04em;
}
.dbh-gal-stats span { display: inline-flex; align-items: baseline; gap: 4px; }
.dbh-gal-stats b {
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dbh-gal-legend-time {
  margin-left: auto;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}
.dbh-gal-bar[data-empty="true"] .dbh-gal-bar-fill {
  background: color-mix(in srgb, var(--dsw-alias-border-l3) 80%, transparent);
}
/* curve area fill + live point */
.dbh-gal-area {
  fill: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent);
}
.dbh-gal-grid-line {
  stroke: color-mix(in srgb, var(--dsw-alias-border-l1) 90%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.dbh-gal-point {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
  animation: dbh-gal-pulse 2.4s ease-in-out infinite;
}
.dbh-gal-point[data-tone="warn"] { background: var(--dsw-alias-state-warn-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent); }
.dbh-gal-point[data-tone="error"] { background: var(--dsw-alias-state-error-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-error-primary) 22%, transparent); }
@keyframes dbh-gal-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.45); }
}
.dbh-gal-window {
  font-size: 9.5px;
  letter-spacing: .06em;
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
}

/* ── assistant-step takeover (trial) ────────────────────────────────── */
/* Rendered inside the host transcript, so it borrows the host's type scale and
   tokens instead of the panel's compact sizes. */
.dbh-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.6;
}
/* collapsible thought block */
.dbh-think {
  border-left: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, transparent);
}
.dbh-think-head {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-think-head:hover { color: var(--dsw-alias-label-primary); }
.dbh-think-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dbh-think-chev {
  flex: none;
  width: 6px;
  height: 6px;
  margin-bottom: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-think[data-open="true"] .dbh-think-chev { transform: rotate(-135deg); }
.dbh-think-verb { font-weight: 600; letter-spacing: .04em; }
.dbh-think-meta {
  margin-left: auto;
  color: var(--dsw-alias-label-caption);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.dbh-think-body {
  padding: 0 10px 9px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  contain: layout style;
}
.dbh-think-preview {
  padding: 0 10px 8px;
  overflow: hidden;
  color: var(--dsw-alias-label-caption);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-step-tool {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  font-size: 12px;
  overflow: hidden;
}
.dbh-step-tool-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 5px 9px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
}
.dbh-step-tool-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dbh-step-tool-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dbh-step-tool-chev {
  flex: none;
  width: 5px;
  height: 5px;
  margin-bottom: 2px;
  border-right: 1.4px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.4px solid var(--dsw-alias-label-tertiary);
  transform: rotate(45deg);
  transition: transform var(--dbh-dur) var(--dbh-ease);
}
.dbh-step-tool[data-open="true"] .dbh-step-tool-chev { transform: rotate(-135deg); }
.dbh-step-tool-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 9px 8px;
}
.dbh-step-tool-pre {
  margin: 0;
  max-height: 220px;
  padding: 7px 8px;
  overflow: auto;
  border-radius: 6px;
  background: var(--dsw-alias-markdown-code-block);
  font-family: var(--dsw-code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.dbh-step-tool-out { color: var(--dsw-alias-label-primary); }
.dbh-step-tool-link {
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-link);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  appearance: none;
}
.dbh-step-tool-link:hover { text-decoration: underline; text-underline-offset: 2px; }
.dbh-step-tool-link:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dbh-step-tool-note { color: var(--dsw-alias-label-caption); font-size: 11px; }
.dbh-step-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
}
.dbh-step-tool-name {
  flex: none;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dbh-step-tool-args {
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dbh-step-note {
  padding: 6px 9px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 8px;
  color: var(--dsw-alias-label-caption);
  font-size: 12px;
}
`

