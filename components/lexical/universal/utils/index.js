import { hasMarkdownFormat } from '@/components/lexical/universal/commands/formatting'
import { $getRoot, $isElementNode } from 'lexical'
import { $isMarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import { $isLinkNode } from '@lexical/link'
import { hasMarkdownLink } from '../commands/links'
import { getSelectedNode } from '../../utils/selection'
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { $isListNode, ListNode } from '@lexical/list'

export function $findTopLevelElement (node) {
  return $findMatchingParent(node, (parentNode) => $isElementNode(parentNode) && !parentNode.isInline())
}

export function snHasFormat (selection, type) {
  if (!selection) return false
  const markdownMode = $isMarkdownMode()
  return markdownMode
    ? hasMarkdownFormat(selection, type)
    : selection.hasFormat(type)
}

export function snHasBlockType (selection, type) {
  if (!selection) return false
  const markdownMode = $isMarkdownMode()
  return markdownMode
    ? hasMarkdownFormat(selection, type)
    : selection.hasFormatType(type)
}

export function snGetElementFormat (selection) {
  if (!selection) return 'left'
  const markdownMode = $isMarkdownMode()
  if (!markdownMode) {
    const node = getSelectedNode(selection)
    const parent = node.getParent()
    let matchingParent
    if ($isLinkNode(parent)) {
      matchingParent = $findMatchingParent(node, (parentNode) => $isElementNode(parentNode) && !parentNode.isInline())
    }
    const current = $isElementNode(matchingParent)
      ? matchingParent.getFormatType()
      : $isElementNode(node)
        ? node.getFormatType()
        : parent?.getFormatType() || 'left'
    return current
  }
  const text = selection.getTextContent().trim()
  if (text.startsWith('<div align="center">') && text.endsWith('</div>')) return 'center'
  if (text.startsWith('<div align="right">') && text.endsWith('</div>')) return 'right'
  if (text.startsWith('<div align="justify">') && text.endsWith('</div>')) return 'justify'
  return 'left'
}

export function snGetCodeLanguage ({ selection, editor }) {
  if (!selection) return ''
  const markdownMode = $isMarkdownMode()
  if (!markdownMode) {
    const anchorNode = selection.anchor.getNode()
    const element = $findTopLevelElement(anchorNode)
    const elementKey = element.getKey()
    const elementDOM = editor.getElementByKey(elementKey)
    if (elementDOM !== null) {
      if ($isCodeNode(element)) {
        const language = element.getLanguage()
        return language ? normalizeCodeLanguage(language) || language : ''
      }
    }
  }
  const raw = selection.getTextContent()
  if (!raw) return 'normal'
  const text = raw.trim()
  if (text.startsWith('```') && text.endsWith('```') && text.length >= 6) {
    // extract language from the opening fence if present
    const lines = text.split('\n')
    const firstLine = lines[0]
    const language = firstLine.slice(3).trim()
    return language ? normalizeCodeLanguage(language) || language : ''
  }
  return ''
}

export function snGetBlockType ({ selection, editor }) {
  if (!selection) return 'normal'
  const markdownMode = $isMarkdownMode()
  if (!markdownMode) {
    const anchorNode = selection.anchor.getNode()
    const element = $findTopLevelElement(anchorNode)
    const elementKey = element.getKey()
    const elementDOM = editor.getElementByKey(elementKey)
    if (elementDOM !== null) {
      if ($isListNode(element)) {
        const parentList = $getNearestNodeOfType(anchorNode, ListNode)
        const blockType = parentList ? parentList.getListType() : element.getListType()
        return blockType
      } else {
        const blockType = $isHeadingNode(element) ? element.getTag() : element.getType()
        return blockType
      }
    }
  }
  const raw = selection.getTextContent()
  if (!raw) return 'normal'

  const text = raw
  const lines = text.split('\n').filter(l => l.length > 0)
  if (lines.length === 0) return 'normal'

  const first = lines[0].trim()

  // TODO for sox
  // I think we should review these and go with a simpler route.
  // fenced code block
  const fenced = text.trim()
  if (fenced.startsWith('```') && fenced.endsWith('```') && fenced.length >= 6) return 'code'

  // headings
  if (/^#\s/.test(first)) return 'h1'
  if (/^##\s/.test(first)) return 'h2'
  if (/^###\s/.test(first)) return 'h3'

  // quote
  if (/^>\s?/.test(first)) return 'quote'

  // lists
  if (/^[-*]\s+/.test(first)) return 'bullet'
  if (/^- \[\s\]\s+/.test(first)) return 'check'
  if (/^\d+\.\s+/.test(first)) return 'number'

  return 'normal'
}

export function snHasLink (selection) {
  if (!selection) return false
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    return hasMarkdownLink(selection)
  }

  const node = getSelectedNode(selection)
  const parent = node.getParent()

  if ($isLinkNode(parent) || $isLinkNode(node)) {
    return true
  }
  return false
}

// only in editor reads and updates or commands
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}
