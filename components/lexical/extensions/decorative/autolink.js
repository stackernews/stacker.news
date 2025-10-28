import { defineExtension } from '@lexical/extension'
import { AutoLinkNode, AutoLinkExtension } from '@lexical/link'
import { $createEmbedNode } from '@/lib/lexical/nodes/content/embeds'
import { $createMediaNode } from '@/lib/lexical/nodes/content/media/media'
import { getInnerType } from '@/lib/lexical/transformers/content/media-or-link'

export const SNAutoLinkExtension = defineExtension({
  dependencies: [AutoLinkExtension],
  name: 'SNAutoLinkExtension',
  register: (editor) => {
    return editor.registerNodeTransform(AutoLinkNode, (node) => {
      console.log('intercepted auto link node transform', node)
      const url = node.getURL()
      const innerType = getInnerType(url)
      const newNode = innerType.provider ? $createEmbedNode(innerType) : $createMediaNode({ src: url })
      node.replace(newNode)
      newNode.selectNext()
    })
  }
})
