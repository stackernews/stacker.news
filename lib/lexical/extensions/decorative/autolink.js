import { defineExtension } from '@lexical/extension'
import { AutoLinkNode, $createAutoLinkNode } from '@lexical/link'
import { $createEmbedNode } from '@/lib/lexical/nodes/content/embeds'
import { $createMediaNode } from '@/lib/lexical/nodes/content/media/media'
import { getInnerType } from '@/lib/lexical/transformers/content/media-or-link'
import { $isMarkdownMode } from '@/lib/lexical/universal/utils'
import { AUTOLINK_URL_REGEXP } from '@/lib/url'
import { mergeRegister } from '@lexical/utils'
import { PASTE_COMMAND, COMMAND_PRIORITY_HIGH, $insertNodes } from 'lexical'
import { getItemID } from '@/lib/lexical/transformers/misc/sn-item'
import { $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item-mention'

export const SNAutoLinkExtension = defineExtension({
  dependencies: [],
  name: 'SNAutoLinkExtension',
  register: (editor) => {
    return mergeRegister(
      editor.registerNodeTransform(AutoLinkNode, (node) => {
        if (editor.getEditorState().read(() => $isMarkdownMode())) return
        const url = node.getURL()
        const innerType = getInnerType(url)
        const newNode = innerType.provider ? $createEmbedNode(innerType) : $createMediaNode({ src: url })
        node.replace(newNode)
        newNode.selectNext()
      }),
      editor.registerCommand(PASTE_COMMAND, (event) => {
        const text = event.clipboardData.getData('text/plain')
        const url = text?.match(AUTOLINK_URL_REGEXP)?.[0]
        if (url) {
          const id = getItemID(url)
          if (id) {
            const itemMentionNode = $createItemMentionNode(id)
            $insertNodes([itemMentionNode])
            return true
          }
          const newNode = $createAutoLinkNode(url)
          $insertNodes([newNode])
          return true
        }
        return false
      }, COMMAND_PRIORITY_HIGH)
    )
  }
})
