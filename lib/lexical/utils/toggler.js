import { $getSelection, $isRangeSelection } from 'lexical'
/**
 * -------- Lexical integration (Markdown toggling inside code blocks) --------
 *
 * This utility mirrors the behaviors supported by this module (bold, italic, code,
 * headers, lists, links, images, quotes, tasks, mention/ref, strikethrough), but
 * operates on a Lexical selection inside a Markdown *code block*. It toggles
 * markdown delimiters around the current selection, or inserts them at the caret.
 *
 * Notes:
 * - We purposely keep the Lexical types as `any`/ambient to avoid importing Lexical here.
 * - Selection preservation is best-effort; complex multi-node selections will be replaced
 *   with transformed text and the caret will end up at the end of the insertion.
 */
// Minimal ambient declarations so this file can compile without depending on Lexical types.
// If Lexical is present in your build, its actual types/functions will be used at runtime.

// Keep a separate style map for this pure utility.

const manualStyles = {
  'header-1': { prefix: '# ' },
  'header-2': { prefix: '## ' },
  'header-3': { prefix: '### ' },
  'header-4': { prefix: '#### ' },
  'header-5': { prefix: '##### ' },
  'header-6': { prefix: '###### ' },
  bold: { prefix: '**', suffix: '**', trimFirst: true },
  italic: { prefix: '_', suffix: '_', trimFirst: true },
  quote: { prefix: '> ', multiline: true, surroundWithNewlines: true },
  code: {
    prefix: '`',
    suffix: '`',
    blockPrefix: '```',
    blockSuffix: '```'
  },
  link: { prefix: '[', suffix: '](url)', replaceNext: 'url', scanFor: 'https?://' },
  image: { prefix: '![', suffix: '](url)', replaceNext: 'url', scanFor: 'https?://' },
  'unordered-list': {
    prefix: '- ',
    multiline: true,
    unorderedList: true
  },
  'ordered-list': {
    prefix: '1. ',
    multiline: true,
    orderedList: true
  },
  'check-list': { prefix: '- [ ] ', multiline: true, surroundWithNewlines: true },
  mention: { prefix: '@', prefixSpace: true },
  ref: { prefix: '#', prefixSpace: true },
  strikethrough: { prefix: '~~', suffix: '~~', trimFirst: true }
}

// ------------------ Pure string transformer (no DOM, no textarea) ------------------

function isMulti (text) {
  return text.trim().includes('\n')
}

function splitLines (text) {
  return text.split('\n')
}

function surroundNewlines (textBefore, textAfter) {
  const breaksBefore = textBefore.match(/\n*$/)
  const breaksAfter = textAfter.match(/^\n*/)
  const newlinesBefore = breaksBefore ? breaksBefore[0].length : 0
  const newlinesAfter = breaksAfter ? breaksAfter[0].length : 0
  const prepend = newlinesBefore < 2 && /\S/.test(textBefore) ? '\n'.repeat(2 - newlinesBefore) : ''
  const append = newlinesAfter < 2 && /\S/.test(textAfter) ? '\n'.repeat(2 - newlinesAfter) : ''
  return { prepend, append }
}

function undoOrdered (text) {
  const lines = splitLines(text)
  const rx = /^\d+\.\s+/
  const ok = lines.every(line => rx.test(line))
  if (!ok) return { processed: false, text, removedCount: 0 }
  const removedLengths = lines.map(l => (l.match(rx)?.[0] || '').length)
  const newLines = lines.map(l => l.replace(rx, ''))
  return { processed: true, text: newLines.join('\n'), removedCount: removedLengths.reduce((a, b) => a + b, 0) }
}

function undoUnordered (text) {
  const lines = splitLines(text)
  const prefix = '- '
  const ok = lines.every(line => line.startsWith(prefix))
  if (!ok) return { processed: false, text, removedCount: 0 }
  const newLines = lines.map(l => l.slice(prefix.length))
  return { processed: true, text: newLines.join('\n'), removedCount: prefix.length * lines.length }
}

function makeListPrefix (i, unordered) {
  return unordered ? '- ' : `${i + 1}. `
}

function transformText (selectedText, fullBefore, fullAfter, style) {
  // List handling (works on multi-line selections)
  if (style.orderedList || style.unorderedList) {
    // Try to undo first
    const undo = style.orderedList ? undoOrdered(selectedText) : undoUnordered(selectedText)
    const undoOther = style.orderedList ? undoUnordered(undo.text) : undoOrdered(undo.text)
    if (undo.processed) {
      return { text: undo.text }
    }
    const lines = splitLines(undoOther.text)
    const prefixed = lines.map((line, i) => `${makeListPrefix(i, !!style.unorderedList)}${line}`)
    const { prepend, append } = surroundNewlines(fullBefore, fullAfter)
    return { text: `${prepend}${prefixed.join('\n')}${append}` }
  }

  // Multiline style (e.g., > quote)
  if (style.multiline && isMulti(selectedText)) {
    const lines = splitLines(selectedText)
    const undo = lines.every(l => l.startsWith(style.prefix) && l.endsWith(style.suffix || ''))
    let result
    if (undo) {
      result = lines.map(l => l.slice(style.prefix.length, style.suffix ? l.length - style.suffix.length : undefined)).join('\n')
    } else {
      result = lines.map(l => `${style.prefix}${l}${style.suffix || ''}`).join('\n')
      if (style.surroundWithNewlines) {
        const { prepend, append } = surroundNewlines(fullBefore, fullAfter)
        result = `${prepend}${result}${append}`
      }
    }
    return { text: result }
  }

  // Inline/block code: prefer block fences if multi-line
  if (selectedText && isMulti(selectedText) && style.blockPrefix && style.blockSuffix) {
    const fenced = `${style.blockPrefix}\n${selectedText}\n${style.blockSuffix}`
    // Undo if already fenced
    if (selectedText.startsWith(`${style.blockPrefix}\n`) && selectedText.endsWith(`\n${style.blockSuffix}`)) {
      const inner = selectedText.slice(style.blockPrefix.length + 1, selectedText.length - (style.blockSuffix.length + 1))
      return { text: inner }
    }
    return { text: fenced }
  }

  // Inline wrapping
  const prefixToUse = style.prefix || ''
  const suffixToUse = style.suffix || ''
  const starts = selectedText.startsWith(prefixToUse)
  const ends = selectedText.endsWith(suffixToUse)
  if (starts && ends && (prefixToUse || suffixToUse)) {
    // Undo
    const inner = selectedText.slice(prefixToUse.length, selectedText.length - suffixToUse.length)
    return { text: inner }
  }

  // Link/image convenience: if selection looks like a URL, drop it into the suffix template
  if (style.replaceNext && style.scanFor) {
    const re = new RegExp(`^${style.scanFor}$`)
    if (re.test(selectedText)) {
      const injected = suffixToUse.replace(style.replaceNext, selectedText)
      return { text: `${prefixToUse}${injected}` }
    }
  }

  // Default: wrap
  return { text: `${prefixToUse}${selectedText}${suffixToUse}` }
}

/**
 * Toggle a markdown style for the current Lexical selection. If the selection is
 * inside a code block, this inserts/removes literal markdown delimiters.
 *
 * Example (italic):
 * - Given selection "***text***" and type "italic" ⟶ becomes "**text**"
 * - Given selection "**text**" and type "italic" ⟶ becomes "***text***"
 */
export function toggleMarkdownInLexical (editor, type) {
  const style = manualStyles[type]
  if (!style) return

  editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return

    // We work with plain text of the selection, independent of node boundaries.
    const selectedText = selection.getTextContent()
    const textBefore = selection.getTextContent().slice(0, 0) // placeholder, we don't have surrounding context easily
    const textAfter = selection.getTextContent().slice(0, 0) // placeholder, same as above

    // Transform selected text according to style rules
    const { text } = transformText(selectedText, textBefore, textAfter, style)

    // Replace the selection contents. This works across multi-node selections.
    selection.insertText(text)

    // Best-effort caret behavior: if we wrapped or unwrapped, try to keep selection on inner text.
    // For simplicity, we place the caret at the end of the newly inserted text. Advanced selection
    // preservation (inner highlighting) can be layered in where needed by the caller.
  })
}
