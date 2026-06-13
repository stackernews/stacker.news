import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { $getNodeByKey, $createTextNode } from 'lexical'
import Link from 'next/link'
import { useCallback } from 'react'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { formatToClassName } from '@/lib/lexical/mdast/format'
import { getLinkAttributes } from '@/lib/url'
import { $createLinkNode } from '@lexical/link'

export default function MentionsComponent ({ nodeKey, href, text, format = 0 }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const className = formatToClassName(format) || undefined

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
        textNode.setFormat(node.getFormat())
        newNode = $createLinkNode(url, { target, rel })
          .append(textNode)
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

  if (!isEditable) return <Link className={className} href={href}>{text}</Link>

  return <span className={className} title='double click to edit'>{text}</span>
}
