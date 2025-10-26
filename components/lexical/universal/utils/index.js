import { $getRoot, $isRootOrShadowRoot, createEditor, $selectAll, $getSelection, $createTextNode } from 'lexical'
import { $isMarkdownNode, $createMarkdownNode } from '@/lib/lexical/nodes/core/markdown'
import { $findMatchingParent } from '@lexical/utils'
import { $isRootTextContentEmpty } from '@lexical/text'
import DefaultNodes from '@/lib/lexical/nodes'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

export function $findTopLevelElement (node) {
  let topLevelElement = node.getKey() === 'root'
    ? node
    : $findMatchingParent(node, (e) => {
      const parent = e.getParent()
      return parent !== null && $isRootOrShadowRoot(parent)
    })

  if (topLevelElement === null) {
    topLevelElement = node.getTopLevelElementOrThrow()
  }

  return topLevelElement
}

export function $toggleMarkdownMode () {
  const root = $getRoot()
  const markdownMode = $isMarkdownMode()
  if (markdownMode) {
    const firstChild = root.getFirstChild()
    // bypass markdown node removal protection
    if (typeof firstChild.bypassProtection === 'function') firstChild.bypassProtection()
    $convertFromMarkdownString(firstChild.getTextContent(), SN_TRANSFORMERS, undefined, true)
  } else {
    const markdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
    const codeNode = $createMarkdownNode()
    codeNode.append($createTextNode(markdown))
    root.clear().append(codeNode)
    if (markdown.length === 0) codeNode.select()
  }
}

// only in editor reads and updates or commands
export function $isMarkdownMode () {
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild)
}

export function $isRootEmpty () {
  if (!$isMarkdownMode()) {
    const root = $getRoot()
    const children = root.getChildren()
    return children.length === 0 || (children.length === 1 && $isRootTextContentEmpty())
  }
  const root = $getRoot()
  const firstChild = root.getFirstChild()
  return $isMarkdownNode(firstChild) && firstChild.getTextContent().trim() === ''
}

export function $initializeMarkdown () {
  const codeNode = $createMarkdownNode()
  const root = $getRoot()
  root.clear().append(codeNode)
}

// wip
export function experimentalDumbMarkdown (selection, formatType, transformation) {
  if (formatType !== 'format' && formatType !== 'block' && formatType !== 'elementFormat') return
  if (!selection) return
  const text = selection.getTextContent()
  // create a temporary rich editor
  const tempEditor = createEditor({
    nodes: [...DefaultNodes],
    theme: null
  })

  // convert the markdown selection to lexical
  tempEditor.update(() => {
    $convertFromMarkdownString(text, SN_TRANSFORMERS, undefined, true)
  })

  let newMarkdown = ''

  tempEditor.read(() => {
    const root = $getRoot()
    const firstChild = root.getFirstChild()
    console.log('firstChild', firstChild.getTextContent())
  })

  // apply the type to the selection
  tempEditor.update(() => {
    $selectAll()
    const innerSelection = $getSelection()
    if (formatType === 'format') {
      innerSelection.formatText(transformation)
    } else if (formatType === 'block') {
      // Use direct node manipulation for block formatting since commands don't work in temp editor

    } else if (formatType === 'elementFormat') {
      // Handle element formatting (alignments)
      const nodes = innerSelection.getNodes()
      nodes.forEach(node => {
        const element = $findTopLevelElement(node)
        if (element && element.setFormat) {
          const formatMap = {
            left: 1,
            center: 2,
            right: 3,
            justify: 4,
            start: 5,
            end: 6
          }
          element.setFormat(formatMap[transformation] || 0)
        }
      })
    }
    console.log('selection', innerSelection.getTextContent())
    console.log('transformation', transformation)
  })

  // convert back to markdown
  tempEditor.read(() => {
    const root = $getRoot()
    const firstChild = root.getFirstChild()
    console.log('firstChild', firstChild.getTextContent())
    newMarkdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
  })

  console.log('newMarkdown', newMarkdown)
  // return the markdown
  // and there I am, the destroyer of worlds
  // what the fuck did I create?
  selection.insertText(newMarkdown)
  return true
}
