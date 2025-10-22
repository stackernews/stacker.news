import { hasMarkdownFormat } from '@/components/lexical/universal/commands/formatting'
import { $isElementNode } from 'lexical'
import { $isLinkNode } from '@lexical/link'
import { hasMarkdownLink } from '../commands/links'
import { getSelectedNode } from '../../utils/selection'
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils'
import { $isHeadingNode } from '@lexical/rich-text'
import { $isCodeNode } from '@lexical/code'
import { normalizeCodeLanguage } from '@lexical/code-shiki'
import { $isListNode, ListNode } from '@lexical/list'
import { $findTopLevelElement, $isMarkdownMode } from '@/components/lexical/universal/utils'
import { mdGetTypes } from '@/lib/md'

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
    return current || 'left'
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
  if (!raw) return ''
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
  if (!selection) return 'paragraph'
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
        return blockType || 'paragraph'
      }
    }
  }
  const text = selection.getTextContent()
  if (!text) return 'paragraph'
  const micromark = mdGetTypes(text)
  if (micromark.length > 0) {
    if (micromark.includes('h1') || micromark.includes('h2') || micromark.includes('h3')) {
      return micromark.find(type => type === 'h1' || type === 'h2' || type === 'h3') || 'paragraph'
    } else if (micromark.includes('number') || micromark.includes('bullet') || micromark.includes('check')) {
      return micromark.find(type => type === 'number' || type === 'bullet' || type === 'check') || 'paragraph'
    } else if (micromark.includes('quote')) {
      return 'quote'
    } else if (micromark.includes('code')) {
      console.log('code', micromark)
      return 'code'
    }
  }
  return 'paragraph'
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
