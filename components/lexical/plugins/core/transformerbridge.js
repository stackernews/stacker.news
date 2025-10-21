import { useRef, useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { createEditor, createCommand, $selectAll, $getSelection, COMMAND_PRIORITY_EDITOR, $createParagraphNode } from 'lexical'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'
import { $findTopLevelElement } from '@/components/lexical/universal/utils'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'
import { $setBlocksType } from '@lexical/selection'

export const USE_TRANSFORMER_BRIDGE = createCommand('USE_TRANSFORMER_BRIDGE')

// will be used by the toolbar to toggle markers for markdown
export default function TransformerBridgePlugin ({ nodes }) {
  const [editor] = useLexicalComposerContext()
  // headless editor used as bridge between micromark and lexical
  const bridge = useRef(null)
  // create the bridge if it doesn't exist and return it
  const createBridge = useCallback(() => bridge.current || (bridge.current = createEditor({ nodes })), [])

  useEffect(() => {
    createBridge()
    return () => {
      bridge.current = null
    }
  }, [editor, createBridge])

  // WIP
  useEffect(() => {
    return editor.registerCommand(USE_TRANSFORMER_BRIDGE, ({ selection, formatType, transformation }) => {
      const transformerBridge = createBridge()
      if (!transformerBridge) return
      let newMarkdown = ''
      const markdown = selection.getTextContent()
      transformerBridge.update(() => {
        $convertFromMarkdownString(markdown, SN_TRANSFORMERS, undefined, true)
        $selectAll()
        const innerSelection = $getSelection()
        if (formatType === 'format') {
          innerSelection.formatText(transformation)
        } else if (formatType === 'block') {
          switch (transformation) {
            case 'paragraph':
              $setBlocksType(innerSelection, () => $createParagraphNode())
              break
            case 'h1':
            case 'h2':
            case 'h3':
              $setBlocksType(innerSelection, () => $createHeadingNode(transformation))
              break
            case 'quote':
              $setBlocksType(innerSelection, () => $createQuoteNode())
              break
            case 'code':
              $setBlocksType(innerSelection, () => $createCodeNode())
              break
          }
        } else if (formatType === 'elementFormat') {
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
        console.log('formatType', formatType)
        console.log('markdown', markdown)
      })
      transformerBridge.read(() => {
        newMarkdown = $convertToMarkdownString(SN_TRANSFORMERS, undefined, true)
      })
      selection.insertText(newMarkdown)
      return true
    }, COMMAND_PRIORITY_EDITOR)
  }, [editor, createBridge, SN_TRANSFORMERS])

  return null
}
