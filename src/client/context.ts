/**
 * The slice of a Client Cordis context this plugin actually touches.
 *
 * Declared structurally on purpose: the real `@deepseek-ai/dsh-client-ui-slots`
 * / `-ui-theme` packages ship their types inside the Harness installation and
 * change between releases, while these five members are the stable, documented
 * contract (`ctx.effect`, `ctx.slots.inject`, `ctx.slots.register`,
 * `ctx.theme.overrideTokens`). Keeping the surface local means the plugin builds
 * against any 0.2.x client without pinning internal packages, and a rename shows
 * up as one compile error here instead of a bundle that silently does nothing.
 */

/** A teardown function. */
export type Disposer = () => void

/** Options accepted by `ctx.slots.register`. */
export interface SlotRegisterOptions {
  /** Declared slot key, e.g. `shell.overlay`. */
  name: string
  /** Cell key; required by `list` slots (a fresh id adds a cell beside shipped entries). */
  id?: string
  /** Cell key for `keyed` slots; reusing a shipped key replaces that renderer. */
  key?: string
  /** Position among the entries, ascending. */
  order?: number
  /** Display text where the owner projects one. */
  label?: string | (() => string)
  /** Id of the registering package, shown in diagnostics. */
  registrant?: string
  /** Shadowing priority; lowest renders. */
  priority?: number
}

/** The slot registry service (`ctx.slots`). */
export interface SlotsService {
  /**
   * Run `callback` for each lifetime of the slot's declaration, so registering
   * into a slot that is not mounted yet waits instead of throwing.
   */
  inject(key: string, callback: () => Disposer): Disposer
  /** Add one entry; returns its disposer. */
  register(options: SlotRegisterOptions, component: unknown): Disposer
}

/** One token value per color scheme. */
export interface ThemeTokenPair {
  light: string
  dark: string
}

/** The theme service (`ctx.theme`). */
export interface ThemeService {
  /**
   * Stack a token layer over the active theme. One layer per `source`, and
   * re-calling replaces it; the returned disposer removes exactly that layer.
   */
  overrideTokens(source: string, tokens: Record<string, ThemeTokenPair>): Disposer
}

/** The Client context members this plugin depends on. */
export interface ClientContext {
  slots: SlotsService
  theme: ThemeService
  /** Run an effect owned by the plugin fiber; the body returns its disposer. */
  effect(execute: () => Disposer | void, label?: string): Disposer
}
