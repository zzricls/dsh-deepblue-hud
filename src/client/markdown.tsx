import type { ReactElement, ReactNode } from 'react'

/**
 * Minimal Markdown renderer for the assistant body inside the stepped takeover.
 *
 * A plugin may not import the host's Markdown component (client packages are not
 * importable), so this file owns a deliberately small subset: headings,
 * paragraphs, fenced code, inline code, bold/italic/strike, links, blockquotes,
 * ordered and unordered lists, and horizontal rules.
 *
 * Everything is emitted as React elements and text nodes — there is no
 * `dangerouslySetInnerHTML` anywhere, so model-authored `<script>` stays literal
 * text. Tables, images and nested lists are out of scope for v1.
 */

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'rule' }

const FENCE = /^```\s*([\w-]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*)$/
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/
const UL = /^\s*[-*+]\s+(.*)$/
const OL = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/

/**
 * Split source text into block-level nodes.
 *
 * Fences are tracked first so anything inside them stays verbatim, and an
 * unterminated fence (a stream that is still arriving) is treated as code to the
 * end of the input rather than swallowing the rest as paragraphs.
 *
 * @param source - raw Markdown.
 * @returns blocks in document order.
 */
export function parseBlocks (source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let buffer: string[] = []

  const flushParagraph = (): void => {
    if (buffer.length === 0) return
    const text = buffer.join('\n').trim()
    if (text !== '') blocks.push({ kind: 'paragraph', text })
    buffer = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const fence = FENCE.exec(line)
    if (fence !== null) {
      flushParagraph()
      const lang = fence[1] ?? ''
      const code: string[] = []
      let closed = false
      for (index += 1; index < lines.length; index += 1) {
        const next = lines[index] ?? ''
        if (FENCE.test(next)) {
          closed = true
          break
        }
        code.push(next)
      }
      blocks.push({ kind: 'code', lang, text: code.join('\n') })
      // An unterminated fence consumed the rest; nothing follows to parse.
      if (!closed) break
      continue
    }

    const heading = HEADING.exec(line)
    if (heading !== null) {
      flushParagraph()
      blocks.push({ kind: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' })
      continue
    }

    if (RULE.test(line)) {
      flushParagraph()
      blocks.push({ kind: 'rule' })
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote !== null) {
      flushParagraph()
      const quoted = [quote[1] ?? '']
      while (index + 1 < lines.length) {
        const next = QUOTE.exec(lines[index + 1] ?? '')
        if (next === null) break
        quoted.push(next[1] ?? '')
        index += 1
      }
      blocks.push({ kind: 'quote', text: quoted.join('\n') })
      continue
    }

    const unordered = UL.exec(line)
    const ordered = OL.exec(line)
    if (unordered !== null || ordered !== null) {
      flushParagraph()
      const isOrdered = ordered !== null
      const items: string[] = []
      const pattern = isOrdered ? OL : UL
      let cursor = index
      for (; cursor < lines.length; cursor += 1) {
        const item = pattern.exec(lines[cursor] ?? '')
        if (item === null) break
        items.push(item[1] ?? '')
      }
      index = cursor - 1
      blocks.push({ kind: 'list', ordered: isOrdered, items })
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    buffer.push(line)
  }

  flushParagraph()
  return blocks
}

interface InlineMatch {
  pattern: RegExp
  render: (match: RegExpExecArray, key: string) => ReactNode
}

/**
 * Inline patterns, **unanchored** and scanned for the earliest match.
 *
 * Anchoring them (`/^…/`) was the bug that left stray `**` in the transcript:
 * a line like `先说明一下，然后用 **grep** 定位` has no match at index 0, so the
 * whole line was emitted as literal text with its asterisks intact. Array order
 * breaks ties at the same index, so code wins over emphasis and `**bold**` wins
 * over `*em*`.
 */
const INLINE: InlineMatch[] = [
  { pattern: /`([^`]+)`/, render: (m, key) => <code key={key} className="dbh-md-code">{m[1]}</code> },
  { pattern: /\*\*([^*]+)\*\*/, render: (m, key) => <strong key={key}>{renderInline(m[1] ?? '', key)}</strong> },
  { pattern: /__([^_]+)__/, render: (m, key) => <strong key={key}>{renderInline(m[1] ?? '', key)}</strong> },
  { pattern: /~~([^~]+)~~/, render: (m, key) => <del key={key}>{renderInline(m[1] ?? '', key)}</del> },
  {
    pattern: /\[([^\]]+)\]\(([^)\s]+)\)/,
    render: (m, key) => (
      <a key={key} className="dbh-md-a" href={m[2]} target="_blank" rel="noreferrer noopener">{renderInline(m[1] ?? '', key)}</a>
    ),
  },
  { pattern: /<(https?:\/\/[^>\s]+)>/, render: (m, key) => <a key={key} className="dbh-md-a" href={m[1]} target="_blank" rel="noreferrer noopener">{m[1]}</a> },
  // `*em*`: never starts with a space and never spans one asterisk of a pair
  { pattern: /\*([^\s*][^*]*?)\*/, render: (m, key) => <em key={key}>{renderInline(m[1] ?? '', key)}</em> },
  // `_em_`: only at word boundaries, so snake_case identifiers stay intact
  { pattern: /(?<![A-Za-z0-9])_([^\s_][^_]*?)_(?![A-Za-z0-9])/, render: (m, key) => <em key={key}>{renderInline(m[1] ?? '', key)}</em> },
  // backslash escape: emit the escaped character literally
  { pattern: /\\([\\`*_{}[\]()#+\-.!])/, render: (m, key) => <span key={key}>{m[1]}</span> },
]

/**
 * Render one line of inline Markdown.
 *
 * Recursive so emphasis can contain code and links. Text between matches is
 * emitted as plain strings, which is what makes the output injection-safe by
 * construction.
 *
 * @param text - inline source.
 * @param prefix - key prefix, so nested nodes stay unique.
 * @returns React nodes.
 */
export function renderInline (text: string, prefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let index = 0
  while (rest !== '') {
    let best: { at: number; found: RegExpExecArray; entry: InlineMatch } | null = null
    for (const entry of INLINE) {
      const found = entry.pattern.exec(rest)
      if (found === null || found[0] === '') continue
      if (best === null || found.index < best.at) best = { at: found.index, found, entry }
    }
    if (best === null) {
      nodes.push(rest)
      break
    }
    if (best.at > 0) nodes.push(rest.slice(0, best.at))
    nodes.push(best.entry.render(best.found, `${prefix}-${index}`))
    rest = rest.slice(best.at + best.found[0].length)
    index += 1
  }
  return nodes
}

function renderBlock (block: Block, index: number): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(block.level, 6)
      const Tag = `h${level}` as 'h1'
      return <Tag key={index} className="dbh-md-h">{renderInline(block.text, `h${index}`)}</Tag>
    }
    case 'paragraph':
      return <p key={index} className="dbh-md-p">{renderInline(block.text, `p${index}`)}</p>
    case 'code':
      return (
        <pre key={index} className="dbh-md-pre">
          {block.lang === '' ? null : <span className="dbh-md-lang">{block.lang}</span>}
          <code>{block.text}</code>
        </pre>
      )
    case 'quote':
      return <blockquote key={index} className="dbh-md-quote">{renderInline(block.text, `q${index}`)}</blockquote>
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag key={index} className="dbh-md-list">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `l${index}-${itemIndex}`)}</li>
          ))}
        </Tag>
      )
    }
    case 'rule':
      return <hr key={index} className="dbh-md-rule" />
    default:
      return null
  }
}

/**
 * Render assistant body text as Markdown.
 *
 * @param props.text - raw Markdown source.
 * @returns the rendered blocks.
 */
export function Markdown (props: { text: string }): ReactElement {
  const blocks = parseBlocks(props.text)
  return <div className="dbh-md">{blocks.map(renderBlock)}</div>
}
