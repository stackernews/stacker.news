import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { $getNodeByKey, $createTextNode } from 'lexical'
import Link from 'next/link'
import { useCallback } from 'react'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { getLinkAttributes } from '@/lib/url'
import { $createLinkNode } from '@lexical/link'

export default function MentionsComponent ({ nodeKey, href, text }) {
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
        const { target, rel } = getLinkAttributes(url)
        newNode = $createLinkNode(url, { target, rel })
          .append($createTextNode(url))
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

  if (!isEditable) return <Link href={href}>{text}</Link>

  return <span title='double click to edit'>{text}</span>
}
