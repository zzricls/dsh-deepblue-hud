import type { ClientContext, Disposer } from './context'
import { SessionDock } from './Bridge'
import { AssistantStepView } from './StepView'
import { Cockpit } from './panel'
import { PANEL_CSS } from './styles'
import { DEEP_BLUE, OVERRIDE_SOURCE } from './theme'

/** Package name; also the module id the loader registered and the CSS tag key. */
const PLUGIN_ID = 'dsh-deepblue-hud'

/** The frame-wide slot the panel occupies: additive, above every column. */
const PANEL_SLOT = 'shell.overlay'

/** A session-scoped seat, used only to reach the projection hooks. */
const COLLECTOR_SLOT = 'conversation.input.dock'

/** Keyed Chat-node renderer replaced by the typing trial (see StepView.tsx). */
const CHAT_NODE_SLOT = 'conversation.chat.node'
const CHAT_NODE_KEY = 'assistant-step'

/**
 * Trial switch: take over the assistant-step renderer so reasoning text types
 * out in the transcript. `false` hands the step straight back to the shipped
 * renderer — this is the one line to flip if the trial looks wrong.
 */
const TAKE_OVER_STEP = true

/** Cell ids; fresh ids add cells beside the shipped entries. */
const PANEL_ID = PLUGIN_ID
const COLLECTOR_ID = `${PLUGIN_ID}.collector`
const STEP_ID = `${PLUGIN_ID}.step`

/**
 * Services this Client half needs. Declared so the plugin stays inactive (and
 * reports a missing-service diagnostic) instead of throwing on a composition
 * without the slot registry or the theme service.
 */
export const inject = ['slots', 'theme'] as const

/**
 * Client plugin body.
 *
 * Four registrations, all owned by the plugin fiber through `ctx.effect` /
 * `ctx.slots.inject`, so unloading the plugin restores the page exactly:
 *
 * 1. a theme token layer (`overrideTokens`), one layer per source id;
 * 2. a stylesheet node;
 * 3. the `shell.overlay` panel;
 * 4. a headless collector in a session-scoped slot, because session projections
 *    are only reachable from inside a session seat.
 */
export function apply (ctx: ClientContext): void {
  // Theme layer. `overrideTokens` stacks one layer per source over the active
  // theme; disposing it removes exactly this layer, so uninstall restores the
  // user's palette rather than "a" palette.
  ctx.effect(
    () => ctx.theme.overrideTokens(OVERRIDE_SOURCE, DEEP_BLUE),
    'deepblue-hud: token layer',
  )

  // Stylesheet. Tagged with `data-plugin-css` like the shipped bundles so a
  // reload can find and replace it, and so unload removes it.
  ctx.effect((): Disposer => {
    const style = document.createElement('style')
    style.dataset.plugin = PLUGIN_ID
    style.dataset.pluginCss = `${PLUGIN_ID}/panel.css`
    style.textContent = PANEL_CSS
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, 'deepblue-hud: stylesheet')

  // Data collector. Renders nothing; it exists so the panel can show real
  // session numbers from `root` scope.
  ctx.slots.inject(COLLECTOR_SLOT, () => ctx.slots.register(
    {
      name: COLLECTOR_SLOT,
      id: COLLECTOR_ID,
      order: 40,
      registrant: PLUGIN_ID,
    },
    SessionDock,
  ))

  // Trial: replace the assistant-step Chat renderer so reasoning text types out
  // in the transcript. A keyed seat replaces by key, and the shipped entry sits
  // at priority 0 — the lowest priority renders, so this has to be negative.
  if (TAKE_OVER_STEP) {
    ctx.slots.inject(CHAT_NODE_SLOT, () => ctx.slots.register(
      {
        name: CHAT_NODE_SLOT,
        key: CHAT_NODE_KEY,
        priority: -1,
        registrant: STEP_ID,
      },
      AssistantStepView,
    ))
  }

  // Panel. `slots.inject` waits for ui-layout to declare `shell.overlay` instead
  // of throwing while the frame is still mounting, and collapses this entry when
  // that declaration goes away.
  ctx.slots.inject(PANEL_SLOT, () => ctx.slots.register(
    {
      name: PANEL_SLOT,
      id: PANEL_ID,
      order: 60,
      label: 'Cockpit',
      registrant: PLUGIN_ID,
    },
    Cockpit,
  ))
}

/**
 * Exported for the smoke test: the projection → snapshot mapping and the
 * trajectory → activity mapping are the parts worth asserting without a
 * renderer. Cordis only reads `apply` / `inject` from this module, so extra
 * exports are inert at runtime.
 */
export { buildLiveSnapshot } from './liveModel'
export { mapActivity } from './activity'
export { AssistantStepView, findToolResult, prettyArgs } from './StepView'
export { parseBlocks } from './markdown'
export { Markdown } from './markdown'
export { Gallery } from './Gallery'

