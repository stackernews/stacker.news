import {
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE
} from './format-constants.js'

const TEXT_FORMAT_CLASS_NAMES = [
  { flag: IS_BOLD, className: 'sn-text__bold' },
  { flag: IS_ITALIC, className: 'sn-text__italic' },
  { flag: IS_HIGHLIGHT, className: 'sn-text__highlight' },
  { flag: IS_SUPERSCRIPT, className: 'sn-text__superscript' },
  { flag: IS_SUBSCRIPT, className: 'sn-text__subscript' }
]

const TEXT_FORMAT_MDAST_WRAPPERS = [
  { flag: IS_ITALIC, type: 'emphasis' },
  { flag: IS_BOLD, type: 'strong' },
  { flag: IS_STRIKETHROUGH, type: 'delete' },
  { flag: IS_HIGHLIGHT, type: 'highlight' }
]

const TEXT_FORMAT_HTML_TAGS = [
  { flag: IS_SUPERSCRIPT, open: '<sup>', close: '</sup>' },
  { flag: IS_SUBSCRIPT, open: '<sub>', close: '</sub>' },
  { flag: IS_UNDERLINE, open: '<ins>', close: '</ins>' }
]

function normalizeFormat (format) {
  return Number(format) || 0
}

export function formatToClassName (format) {
  const normalizedFormat = normalizeFormat(format)
  const classes = []

  for (const { flag, className } of TEXT_FORMAT_CLASS_NAMES) {
    if (normalizedFormat & flag) {
      classes.push(className)
    }
  }

  if ((normalizedFormat & IS_UNDERLINE) && (normalizedFormat & IS_STRIKETHROUGH)) {
    classes.push('sn-text__underline-strikethrough')
  } else {
    if (normalizedFormat & IS_UNDERLINE) {
      classes.push('sn-text__underline')
    }
    if (normalizedFormat & IS_STRIKETHROUGH) {
      classes.push('sn-text__strikethrough')
    }
  }

  return classes.join(' ')
}

export function formatTextAsMdastChildren (text, format) {
  const normalizedFormat = normalizeFormat(format)
  const children = []
  const closingTags = []

  for (const { flag, open, close } of TEXT_FORMAT_HTML_TAGS) {
    if (normalizedFormat & flag) {
      children.push({ type: 'html', value: open })
      closingTags.unshift({ type: 'html', value: close })
    }
  }

  let textNode = normalizedFormat & IS_CODE
    ? { type: 'inlineCode', value: text }
    : { type: 'text', value: text }

  for (let i = TEXT_FORMAT_MDAST_WRAPPERS.length - 1; i >= 0; i--) {
    const { flag, type } = TEXT_FORMAT_MDAST_WRAPPERS[i]
    if (normalizedFormat & flag) {
      textNode = {
        type,
        children: [textNode]
      }
    }
  }

  children.push(textNode, ...closingTags)
  return children
}
