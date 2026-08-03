import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { $getNodeByKey, $createTextNode } from 'lexical'
import Link from 'next/link'
import { createElement, useCallback } from 'react'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'
import { $isItemMentionNode, getFormatTags } from '@/lib/lexical/nodes/decorative/mentions/item'
import { DEFAULT_FORMAT, IS_CODE } from '@/lib/lexical/mdast/format-constants'
import { getLinkAttributes } from '@/lib/url'
import { $createLinkNode } from '@lexical/link'

function renderFormattedText (text, format) {
  let element = format & IS_CODE ? createElement('code', null, text) : text
  for (const tag of getFormatTags(format)) {
    element = createElement(tag, null, element)
  }
  return element
}

export default function MentionsComponent ({ nodeKey, href, text, format = DEFAULT_FORMAT }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()

  const breakMention = useCallback(() => {
    if (!isEditable) return
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (!node) return

      let newNode
      if ($isItemMentionNode(node)) {
        // item mentions become full links
        const url = node.getURL()
        const displayText = node.getText()
        const { target, rel } = getLinkAttributes(url)
        const textNode = $createTextNode(displayText || url)
        const format = node.getFormat()
        if (format) textNode.setFormat(format)
        newNode = $createLinkNode(url, { target, rel }).append(textNode)
      } else {
        // other mention types become plain text
        // cursor will land on the text node triggering mentions menu
        newNode = $createTextNode(node.getTextContent())
      }

      node.replace(newNode)
      newNode.select()
    })
  }, [editor, nodeKey, isEditable])

  useDecoratorNodeSelection(nodeKey, {
    focusedClass: 'focused',
    deletable: false,
    onDoubleClick: breakMention
  })

  if (!isEditable) return <Link href={href}>{renderFormattedText(text, format)}</Link>

  return <span title='double click to edit'>{renderFormattedText(text, format)}</span>
}
