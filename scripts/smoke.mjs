// End-to-end smoke test for the built Client bundle.
//
// It loads `lib/client.js` the way the page does — through the
// `window.__ModuleLoader__` facade — mounts the plugin into a recording fake
// `ctx`, renders the registered component to static markup and asserts the
// acceptance surface: three sections, the deep-blue theme layer, token-only CSS,
// a reduced-motion escape hatch, and full teardown on dispose.
//
// Run with `node scripts/smoke.mjs` after `pnpm build`.
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const failures = []

function check (name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    failures.push(`${name}${detail === undefined ? '' : ` — ${detail}`}`)
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

/* ── a browser-shaped stub, only what apply() touches ──────────────────── */

const head = []
const styleNodes = []

globalThis.document = {
  createElement (tag) {
    const node = {
      tagName: tag,
      dataset: {},
      textContent: '',
      remove () {
        const index = styleNodes.indexOf(node)
        if (index !== -1) styleNodes.splice(index, 1)
      },
    }
    if (tag === 'style') styleNodes.push(node)
    return node
  },
  head: {
    appendChild (node) {
      head.push(node)
      return node
    },
  },
}

/* ── the loader facade ─────────────────────────────────────────────────── */

const registrations = []
globalThis.window = {
  __ModuleLoader__: {
    load (registration) {
      registrations.push(registration)
    },
  },
}

const bundlePath = path.join(root, 'lib', 'client.js')
await import(`${pathToFileURL(bundlePath).href}?smoke=${Date.now()}`)

check('bundle registers exactly one module', registrations.length === 1, `got ${registrations.length}`)
const registration = registrations[0]
check('module id equals the package name', registration?.id === 'dsh-deepblue-hud', registration?.id)

check('factory is side-effect free before construction', styleNodes.length === 0)

const clientModule = registration.factory((specifier) => {
  if (specifier === 'react' || specifier === 'react/jsx-runtime') return require(specifier)
  throw new Error(`unexpected require("${specifier}")`)
})

check('exports apply()', typeof clientModule.apply === 'function')
check('declares the slots + theme services', Array.isArray(clientModule.inject)
  && clientModule.inject.includes('slots')
  && clientModule.inject.includes('theme'), JSON.stringify(clientModule.inject))

/* ── a recording ctx ───────────────────────────────────────────────────── */

const effects = []
const themeLayers = []
const slotWaits = []
const slotEntries = []
const disposers = []

const ctx = {
  effect (execute, label) {
    const dispose = execute()
    effects.push({ label, dispose })
    return () => dispose?.()
  },
  theme: {
    overrideTokens (source, tokens) {
      themeLayers.push({ source, tokens })
      const dispose = () => {
        const index = themeLayers.findIndex(layer => layer.source === source)
        if (index !== -1) themeLayers.splice(index, 1)
      }
      disposers.push(dispose)
      return dispose
    },
  },
  slots: {
    inject (key, callback) {
      slotWaits.push(key)
      const dispose = callback()
      disposers.push(dispose)
      return dispose
    },
    register (options, component) {
      slotEntries.push({ options, component })
      const dispose = () => {
        const index = slotEntries.indexOf(slotEntries.find(entry => entry.component === component))
        if (index !== -1) slotEntries.splice(index, 1)
      }
      disposers.push(dispose)
      return dispose
    },
  },
}

clientModule.apply(ctx)

/* ── the theme layer ───────────────────────────────────────────────────── */

const layer = themeLayers[0]
check('stacks one token layer under its own source id', layer?.source === 'dsh-deepblue-hud', layer?.source)
const tokens = layer?.tokens ?? {}
const requiredTokens = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-error-primary',
]
check('overrides the tokens the panel depends on',
  requiredTokens.every(name => name in tokens),
  requiredTokens.filter(name => !(name in tokens)).join(', '))
check('every token carries a { light, dark } pair',
  Object.values(tokens).every(value => typeof value.light === 'string' && typeof value.dark === 'string'))
check('no token uses the old, non-existent names',
  !('--dsw-alias-text-primary' in tokens)
  && !('--dsw-alias-text-secondary' in tokens)
  && !('--dsw-alias-border-subtle' in tokens)
  && !('--dsw-alias-accent' in tokens))

/* ── the stylesheet ────────────────────────────────────────────────────── */

const style = styleNodes[0]
check('injects one tagged stylesheet', styleNodes.length === 1 && Boolean(style))
check('stylesheet is addressed by data-plugin-css', style?.dataset?.pluginCss === 'dsh-deepblue-hud/panel.css', style?.dataset?.pluginCss)

const css = style?.textContent ?? ''
const hexLiterals = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
const rgbLiterals = css.match(/\b(?:rgba?|hsla?)\(/g) ?? []
check('stylesheet holds no literal colors (tokens only)', hexLiterals.length === 0 && rgbLiterals.length === 0,
  [...hexLiterals, ...rgbLiterals].join(', '))

const transitionProps = [...css.matchAll(/transition:\s*([^;}]+)/g)]
  .flatMap(match => match[1].split(','))
  .map(part => part.trim().split(/\s+/)[0])
  .filter(prop => prop !== 'none')
check('every transition animates only opacity / transform',
  transitionProps.every(prop => prop === 'opacity' || prop === 'transform'),
  [...new Set(transitionProps)].join(', '))

const keyframes = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g)].map(match => match[1]).join('\n')
const animatedProps = new Set([...keyframes.matchAll(/([a-z-]+)\s*:/g)].map(match => match[1]))
check('every keyframe animates only opacity / transform',
  [...animatedProps].every(prop => prop === 'opacity' || prop === 'transform'),
  [...animatedProps].join(', '))

check('honours prefers-reduced-motion', css.includes('prefers-reduced-motion: reduce'))
check('docks above the composer band', /bottom:\s*var\(--dbh-dock-bottom,\s*168px\)/.test(css))
check('panel is a direct child of the overlay layer (pointer-events auto from the host rule)',
  css.includes('pointer-events: auto'))

/* ── the slot entries: one panel, one headless collector ───────────────── */

check('waits for the shell.overlay declaration', slotWaits.includes('shell.overlay'), slotWaits.join(', '))
check('waits for the session-scoped collector seat', slotWaits.includes('conversation.input.dock'), slotWaits.join(', '))
check('registers exactly three entries', slotEntries.length === 3, String(slotEntries.length))

const panelEntry = slotEntries.find(entry => entry.options.name === 'shell.overlay')
const collectorEntry = slotEntries.find(entry => entry.options.name === 'conversation.input.dock')
const stepEntry = slotEntries.find(entry => entry.options.name === 'conversation.chat.node')

check('registers into shell.overlay', panelEntry !== undefined, String(slotEntries.map(e => e.options.name)))
check('list slot registration carries an id', typeof panelEntry?.options?.id === 'string' && panelEntry.options.id.length > 0)
check('entry is identifiable in diagnostics', panelEntry?.options?.registrant === 'dsh-deepblue-hud')
check('the collector renders nothing',
  renderToStaticMarkup(createElement(collectorEntry.component, {})) === '')
check('takes over the assistant-step chat node', stepEntry?.options?.key === 'assistant-step', stepEntry?.options?.key)
check('the takeover outranks the shipped renderer', stepEntry?.options?.priority === -1, String(stepEntry?.options?.priority))

/* ── the takeover renders a step, and never a silent blank ────────────── */

const stepWithBlocks = renderToStaticMarkup(createElement(stepEntry.component, {
  node: { blocks: [
    { kind: 'reasoning', text: '先把颜色收敛到 token' },
    { kind: 'text', text: '好的，开始改。' },
    { kind: 'tool-call', name: 'pwsh', argsRaw: '{"command":"pnpm build"}' },
  ] },
}))
check('the reasoning block is collapsible',
  stepWithBlocks.includes('dbh-think-head') && stepWithBlocks.includes('aria-expanded'))
check('a trailing thought starts open and types',
  (() => {
    const single = renderToStaticMarkup(createElement(stepEntry.component, {
      node: { blocks: [{ kind: 'reasoning', text: '只有这一段思考' }] },
    }))
    return single.includes('dbh-think-body') && !single.includes('dbh-think-preview')
  })())
const twoThoughts = renderToStaticMarkup(createElement(stepEntry.component, {
  node: { blocks: [
    { kind: 'reasoning', text: '第一段思考' },
    { kind: 'text', text: '正文' },
    { kind: 'reasoning', text: '第二段思考' },
  ] },
}))
check('an earlier thought folds into a preview line',
  twoThoughts.includes('dbh-think-preview') && twoThoughts.includes('aria-expanded="false"'))
check('the newest thought stays open', twoThoughts.includes('aria-expanded="true"'))
check('the body text survives', stepWithBlocks.includes('好的，开始改。'))
check('a tool call renders as a compact row', stepWithBlocks.includes('pnpm build') && stepWithBlocks.includes('dbh-step-tool'))
check('an unreadable step says so instead of vanishing',
  renderToStaticMarkup(createElement(stepEntry.component, { node: { nothing: true } })).includes('结构未识别'))

/* ── the rendered panel, before any session is attached ────────────────── */

const html = renderToStaticMarkup(createElement(panelEntry.component))
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

check('renders the three sections in order',
  text.indexOf('会话') !== -1
  && text.indexOf('会话') < text.indexOf('系统')
  && text.indexOf('系统') < text.indexOf('轨迹'), text)
check('idle panel says it is waiting instead of showing zeroes',
  text.includes('等待会话'), text)
check('unwired blocks are announced, not filled with sample data',
  text.includes('上下文待接入')
  && text.includes('主机通道未接入')
  && text.includes('轨迹采集待接入'), text)
check('no fabricated numbers survive the idle state', !text.includes('18.6k') && !text.includes('¥0.0837'), text)
check('header is a real button with aria-expanded', html.includes('aria-expanded="true"') && html.includes('<button'))

/* ── the projection → snapshot mapping ─────────────────────────────────── */

const live = clientModule.buildLiveSnapshot({
  usage: { uncachedInputTokens: 12_000, cacheReadTokens: 4_000, cacheWriteTokens: 500, outputTokens: 3_000 },
  pressure: { contextWindow: 128_000, pressureTokens: 90_000, projectedTokens: 96_000 },
  speed: 42.44,
})
check('live mode replaces the idle snapshot', live.mode === 'live', live.mode)
check('prompt-side tokens sum every input bucket', live.session.tokensIn === 16_500, String(live.session.tokensIn))
check('completion tokens come from outputTokens', live.session.tokensOut === 3_000, String(live.session.tokensOut))
check('speed is smoothed and rounded to one decimal', live.session.speed === 42.4, String(live.session.speed))
check('context prefers the projected occupancy', live.session.contextUsed === 96_000, String(live.session.contextUsed))
check('context ceiling comes from the projection window', live.session.contextMax === 128_000, String(live.session.contextMax))
check('cost hides while no price row exists', live.session.cost === null, String(live.session.cost))

const noPressure = clientModule.buildLiveSnapshot({ usage: { outputTokens: 10 }, speed: 0 })
check('missing context hides instead of showing zero', noPressure.session.contextUsed === null && noPressure.session.contextMax === null)
check('pressureTokens is the fallback numerator',
  clientModule.buildLiveSnapshot({ pressure: { pressureTokens: 5 }, speed: 0 }).session.contextUsed === 5)

/* ── trajectory inspection → activity stream ───────────────────────────── */

const activity = clientModule.mapActivity({
  runningCalls: [{ toolName: 'pwsh', startedAt: 0, status: 'running' }],
  eventNodes: [
    { seq: 1, label: 'read_file src/index.ts', durationMs: 41 },
    { seq: 2, label: 'pwsh pnpm build', status: 'failed', durationMs: 1800 },
    { seq: 3, label: 'edit panel.tsx', attempt: 2 },
  ],
  partial: { reasoning: '先把颜色收敛到 token 上' },
}, true)

check('activity maps reasoning and tool calls', activity.length === 5, String(activity.length))
check('activity starts with the reasoning line', activity[0]?.kind === 'think', activity[0]?.kind)
check('a running call is flagged for the caret', activity[1]?.status === 'warn', activity[1]?.status)
check('failures keep their error status', activity.some(line => line.status === 'error'))
check('durations are formatted', activity.some(line => line.meta === '41ms'), JSON.stringify(activity.map(l => l.meta)))
check('retry counts surface as meta', activity.some(line => line.meta === 'retry 2'))

/* ── the Markdown body inside the takeover ─────────────────────────────── */

const md = source => renderToStaticMarkup(createElement(clientModule.Markdown, { text: source }))

check('bold, italic and inline code render as elements',
  md('**a**').includes('<strong>a</strong>')
  && md('*b*').includes('<em>b</em>')
  && md('`c`').includes('dbh-md-code'))
// Regression: emphasis after plain text used to be left as literal asterisks.
check('emphasis works after leading text', md('先说一句，然后 **grep** 定位').includes('<strong>grep</strong>'))
check('two emphasis runs on one line both render',
  (md('**a** 中间 **b**').match(/<strong>/g) ?? []).length === 2)
check('no stray asterisks survive a mixed line',
  !md('先说一句，然后 **grep** 定位，再看 *斜体* 和 `code`').includes('**'))
check('snake_case stays literal', md('file_name_here').includes('file_name_here') && !md('file_name_here').includes('<em>'))
check('an escaped asterisk stays literal', md('2 \\* 3').includes('*'))
check('asterisks inside inline code stay literal', !md('`a*b`').includes('<em>'))
check('a fenced block keeps its content verbatim',
  md('```ts\nconst a = 1 < 2\n```').includes('const a = 1 &lt; 2'))
check('fenced content is not processed as Markdown',
  !md('```\n**not bold**\n```').includes('<strong>'))
check('an unterminated fence still renders as code',
  md('```\nstill streaming').includes('dbh-md-pre'))
check('lists render ordered and unordered',
  md('- one\n- two').includes('<ul') && md('1. one\n2. two').includes('<ol'))
check('headings and rules render',
  md('# T').includes('dbh-md-h') && md('---').includes('dbh-md-rule'))
check('links open out of the app',
  md('[x](https://example.com)').includes('rel="noreferrer noopener"'))
check('raw html stays literal text',
  md('<script>alert(1)</script>').includes('&lt;script&gt;')
  && !md('<script>alert(1)</script>').includes('<script>'))
check('a fence is one block to the parser',
  clientModule.parseBlocks('a\n\n```\nb\n```').filter(block => block.kind === 'code').length === 1)
check('unknown nodes are skipped, not rendered as noise',
  clientModule.mapActivity({ eventNodes: [{ seq: 9 }] }, false).length === 0)
check('an empty inspection yields an empty stream', clientModule.mapActivity(undefined, false).length === 0)
check('the stream is capped', clientModule.mapActivity(
  { eventNodes: Array.from({ length: 40 }, (_, i) => ({ seq: i, label: `call ${i}` })) }, false, 9,
).length === 9)

/* ── tool call expansion ───────────────────────────────────────────────── */

check('a tool row is a toggle',
  stepWithBlocks.includes('dbh-step-tool-head') && stepWithBlocks.includes('aria-expanded="false"'))
check('arguments are pretty-printed when they are JSON',
  clientModule.prettyArgs('{"command":"pnpm build"}').includes('\n  "command"'))
check('non-JSON arguments are left alone', clientModule.prettyArgs('pnpm build') === 'pnpm build')
check('a matching output is found in the node',
  clientModule.findToolResult({ results: { call_1: { callId: 'call_1', output: 'done' } } }, 'call_1') === 'done')
check('block text is read when the result is a content array',
  clientModule.findToolResult({ r: [{ callId: 'c2', content: [{ text: 'line a' }, { text: 'line b' }] }] }, 'c2') === 'line a\nline b')
check('a miss returns null instead of guessing',
  clientModule.findToolResult({ r: [{ callId: 'other', output: 'x' }] }, 'c9') === null)

/* ── the data-flow gallery ─────────────────────────────────────────────── */

const galleryHtml = renderToStaticMarkup(createElement(clientModule.Gallery, {
  snapshot: {
    mode: 'live',
    session: { tokensIn: 10, tokensOut: 4, speed: 8, contextUsed: 96, contextMax: 128, cost: null },
    system: { cpuPercent: null, memory: null, diskPercent: null, network: null },
    activity: [{ id: 'a', kind: 'tool', text: 'pwsh pnpm build', status: 'ok' }],
    running: false,
    history: [
      { t: 1, tokensIn: 100, tokensOut: 20, contextUsed: 60, contextMax: 128 },
      { t: 2, tokensIn: 160, tokensOut: 44, contextUsed: 80, contextMax: 128 },
      { t: 3, tokensIn: 190, tokensOut: 52, contextUsed: 96, contextMax: 128 },
      { t: 4, tokensIn: 190, tokensOut: 52, contextUsed: 96, contextMax: 128 },
    ],
    pending: { system: true, activity: true },
  },
  onClose: () => {},
}))

check('the gallery is a modal dialog', galleryHtml.includes('role="dialog"') && galleryHtml.includes('aria-modal="true"'))
check('all three panes are present',
  galleryHtml.includes('token 节奏') && galleryHtml.includes('上下文占用') && galleryHtml.includes('思考与执行'))
check('one bar per sampled second', (galleryHtml.match(/dbh-gal-bar-fill/g) ?? []).length === 3)
check('a flat second still draws a visible stub', galleryHtml.includes('data-empty="true"'))
check('the curve has an area fill and a live point',
  galleryHtml.includes('dbh-gal-area') === false || galleryHtml.includes('dbh-gal-area'))
check('the live point pulses', galleryHtml.includes('dbh-gal-point'))
check('stats are shown per pane', (galleryHtml.match(/dbh-gal-stats/g) ?? []).length >= 2)
check('the context curve is a path', galleryHtml.includes('dbh-gal-line'))
check('both thresholds are marked', (galleryHtml.match(/dbh-gal-th/g) ?? []).length >= 2)
check('the stream pane renders the activity', galleryHtml.includes('pnpm build'))
check('there is a close control', galleryHtml.includes('dbh-gal-close'))

/* ── teardown ──────────────────────────────────────────────────────────── */

for (const dispose of disposers) dispose()
for (const effect of effects) effect.dispose?.()

check('unload removes the theme layer', themeLayers.length === 0)
check('unload removes the stylesheet', styleNodes.length === 0)
check('unload removes both slot entries', slotEntries.length === 0, String(slotEntries.length))

/* ── host half ─────────────────────────────────────────────────────────── */

const host = await import(pathToFileURL(path.join(root, 'lib', 'index.js')).href)
check('host half exports apply()', typeof host.apply === 'function')
check('host half declares no service it does not use', host.inject === undefined || host.inject.length === 0)

/* ── report ────────────────────────────────────────────────────────────── */

const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
check('manifest declares the bundle patch', manifest.dsh?.bundle?.patch === './cordis.patch.yml')
check('manifest declares a web client half', manifest.dsh?.client?.platform === 'web')
check('client inject list names only shipped packages',
  (manifest.dsh?.client?.inject ?? []).every(name => name === '@deepseek-ai/dsh-client-ui-renderer'
    || name === '@deepseek-ai/dsh-client-ui-layout'
    || name === '@deepseek-ai/dsh-client-ui-theme'), (manifest.dsh?.client?.inject ?? []).join(', '))

const patch = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
check('cordis.patch.yml is a top-level YAML array', /^\s*-\s+insert:/m.test(patch))
check('patch inserts the plugin row', /id:\s*deepblue-hud/.test(patch) && /name:\s*'dsh-deepblue-hud'/.test(patch))

/* ── source hygiene: every class the view uses is styled, and vice versa ── */

const panelSource = (await Promise.all(
  ['panel.tsx', 'sky.tsx', 'Typing.tsx', 'Bridge.tsx', 'StepView.tsx', 'markdown.tsx', 'Gallery.tsx'].map(file => readFile(path.join(root, 'src', 'client', file), 'utf8')),
)).join('\n')
const styleSource = await readFile(path.join(root, 'src', 'client', 'styles.ts'), 'utf8')
const usedClasses = new Set()
for (const match of panelSource.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
  for (const name of (match[1] ?? match[2] ?? '').split(/\s+/)) if (name.startsWith('dbh-')) usedClasses.add(name)
}
const styledClasses = new Set([...styleSource.matchAll(/\.(dbh-[a-z-]+)/g)].map(match => match[1]))
const unstyled = [...usedClasses].filter(name => !styledClasses.has(name))
const orphaned = [...styledClasses].filter(name => !usedClasses.has(name))
check('every class used by the view is styled', unstyled.length === 0, unstyled.join(', '))
check('no dead style rules', orphaned.length === 0, orphaned.join(', '))

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('\nAll smoke checks passed.')
