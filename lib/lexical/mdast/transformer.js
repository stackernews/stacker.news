import { $getRoot } from 'lexical'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote'
import { gfm } from 'micromark-extension-gfm'
import { gfmFootnote } from 'micromark-extension-gfm-footnote'
import { math } from 'micromark-extension-math'
import { fromMarkdown as parseMarkdown } from 'mdast-util-from-markdown'
import TRANSFORMERS, { MENTION_EXTENSIONS } from './transformers'

// html tags we convert to lexical formats (sup -> superscript, etc)
const HTML_FORMAT_TAGS = {
  sup: 'superscript',
  sub: 'subscript',
  u: 'underline',
  ins: 'underline',
  s: 'strikethrough',
  del: 'strikethrough',
  mark: 'highlight'
}

const MICROMARK_EXTENSIONS = [
  gfm(),
  math(),
  gfmFootnote(),
  MENTION_EXTENSIONS.micromark
]

const MDAST_EXTENSIONS = [
  gfmFromMarkdown(),
  mathFromMarkdown(),
  gfmFootnoteFromMarkdown(),
  MENTION_EXTENSIONS.fromMarkdown
]

export function toMarkdown (editor) {
  return serializeMdast(toMdast(editor))
}

export function fromMarkdown (editor, markdown) {
  const mdast = parseMarkdownToMdast(markdown)
  editor.update(() => {
    $getRoot().clear().append(...fromMdast(mdast))
  })
}

export function toMdast (editor) {
  const root = { type: 'root', children: [] }
  editor.getEditorState().read(() => {
    root.children = $getRoot().getChildren().flatMap(lexicalNodeToMdast)
  })
  return root
}

export function fromMdast (mdast) {
  const visit = (node) => {
    // formattedText is our extended type for multi-format text (bold+italic, superscript, etc)
    // we unwrap it and apply the formats to the resulting lexical nodes
    if (node.type === 'formattedText') {
      return unwrapFormattedText(node, visit)
    }

    // find a transformer that can handle this node
    for (const t of TRANSFORMERS) {
      if (!t.fromMdast || !matchesMdastType(node, t.mdastType)) continue
      const result = t.fromMdast(node, visitChildren)
      if (result) return result
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[mdast] no transformer for: ${node.type}`)
    }
    return null
  }

  const visitChildren = (children) => children.flatMap(visit).filter(Boolean)

  return mdast.type === 'root'
    ? visitChildren(mdast.children)
    : [visit(mdast)].filter(Boolean)
}

export function serializeMdast (node) {
  if (Array.isArray(node)) {
    return node.map(serializeMdast).join('')
  }

  if (node.type === 'root') {
    return serializeMdast(node.children)
  }

  // find a transformer that can serialize this node type
  for (const t of TRANSFORMERS) {
    if (t.toMarkdown && matchesMdastType(node, t.mdastType)) {
      return t.toMarkdown(node, serializeMdast)
    }
  }

  // fallback: just serialize children
  if (node.children) {
    return serializeMdast(node.children)
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[mdast] no serializer for: ${node.type}`)
  }
  return ''
}

function lexicalNodeToMdast (node) {
  const nodeType = node.getType()

  for (const t of TRANSFORMERS) {
    if (t.type === nodeType && t.toMdast) {
      const result = t.toMdast(node, lexicalNodeToMdast)
      if (result) return result
    }
  }

  // no transformer found - try to recurse into children
  if (node.getChildren) {
    return node.getChildren().flatMap(lexicalNodeToMdast)
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[mdast] no transformer for lexical type: ${nodeType}`)
  }
  return []
}

function parseMarkdownToMdast (markdown) {
  const mdast = parseMarkdown(markdown, {
    extensions: MICROMARK_EXTENSIONS,
    mdastExtensions: MDAST_EXTENSIONS
  })

  // convert html format tags (<sup>, <sub>, etc) into our formattedText nodes
  processHtmlFormats(mdast)

  return mdast
}

// walk the tree and convert <sup>text</sup>-like patterns into formattedText nodes
// this lets us handle html format tags that markdown syntax can't express
function processHtmlFormats (node) {
  if (!node.children) return

  for (let i = 0; i < node.children.length; i++) {
    // recurse first so we process innermost tags first
    processHtmlFormats(node.children[i])

    const opening = parseOpeningTag(node.children[i])
    if (!opening) continue

    const closeIdx = findClosingTag(node.children, opening.tag, i + 1)
    if (closeIdx === -1) continue

    // grab everything between <tag> and </tag>, wrap it
    const innerNodes = node.children.slice(i + 1, closeIdx)
    const wrapped = {
      type: 'formattedText',
      formats: [opening.format],
      children: innerNodes,
      data: { htmlTag: opening.tag }
    }

    // replace <tag>...content...</tag> with the single wrapped node
    node.children.splice(i, closeIdx - i + 1, wrapped)
  }
}

function parseOpeningTag (node) {
  if (node.type !== 'html') return null

  const match = node.value?.match(/^<([a-z]+)>$/i)
  if (!match) return null

  const tag = match[1].toLowerCase()
  const format = HTML_FORMAT_TAGS[tag]
  return format ? { tag, format } : null
}

function findClosingTag (children, tag, startIdx) {
  for (let i = startIdx; i < children.length; i++) {
    if (children[i].type === 'html' && children[i].value === `</${tag}>`) {
      return i
    }
  }
  return -1
}

function unwrapFormattedText (node, visit) {
  const results = []

  for (const child of node.children) {
    const lexicalNode = visit(child)
    if (!lexicalNode) continue

    // apply each format (bold, italic, superscript, etc) to the lexical node
    const nodes = Array.isArray(lexicalNode) ? lexicalNode : [lexicalNode]
    for (const n of nodes) {
      if (n.toggleFormat) {
        for (const format of node.formats || []) {
          n.toggleFormat(format)
        }
      }
      results.push(n)
    }
  }

  return results
}

function matchesMdastType (node, mdastType) {
  if (!mdastType) return false
  if (Array.isArray(mdastType)) return mdastType.includes(node.type)
  return node.type === mdastType
}
