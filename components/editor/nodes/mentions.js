import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { $getNodeByKey, $createTextNode } from 'lexical'
import Link from 'next/link'
import { useCallback } from 'react'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { getLinkAttributes } from '@/lib/url'
import { $createLinkNode } from '@lexical/link'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_SUPERSCRIPT,
  IS_SUBSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

function renderFormattedText (text, format) {
  if (!format) return text
  let content = text
  if (format & IS_CODE) content = <code>{content}</code>
  if (format & IS_HIGHLIGHT) content = <mark className='sn-text__highlight'>{content}</mark>
  if (format & IS_STRIKETHROUGH) content = <s className='sn-text__strikethrough'>{content}</s>
  if (format & IS_BOLD) content = <strong className='sn-text__bold'>{content}</strong>
  if (format & IS_ITALIC) content = <em className='sn-text__italic'>{content}</em>
  if (format & IS_UNDERLINE) content = <u className='sn-text__underline'>{content}</u>
  if (format & IS_SUBSCRIPT) content = <sub className='sn-text__subscript'>{content}</sub>
  if (format & IS_SUPERSCRIPT) content = <sup className='sn-text__superscript'>{content}</sup>
  return content
}

export default function MentionsComponent ({ nodeKey, href, text, format = 0 }) {
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
        const nodeFormat = node.getFormat() || 0
        const { target, rel } = getLinkAttributes(url)
        newNode = $createLinkNode(url, { target, rel })
          .append($createTextNode(displayText || url).setFormat(nodeFormat))
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

  const formattedText = renderFormattedText(text, format)

  if (!isEditable) return <Link href={href}>{formattedText}</Link>

  return <span title='double click to edit'>{formattedText}</span>
}
