import { defineExtension, $isParagraphNode, RootNode } from 'lexical'
import { $createGalleryNode, $isGalleryNode } from '@/lib/lexical/nodes/content/gallery'
import { $isMediaNode } from '@/lib/lexical/nodes/content/media'

function isMediaOnlyParagraph (node) {
  if (!$isParagraphNode(node)) return false
  const children = node.getChildren()
  if (children.length === 0) return false
  return children.every($isMediaNode)
}

export const GalleryExtension = defineExtension({
  name: 'GalleryExtension',
  register: (editor) => {
    return editor.registerNodeTransform(RootNode, (root) => {
      const children = root.getChildren()

      // adjacent paragraphs that only contain a MediaNode should be wrapped in a GalleryNode
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if ($isGalleryNode(child)) continue
        if (!isMediaOnlyParagraph(child)) continue

        // find all adjacent paragraphs that only contain MediaNodes and collect their media
        const run = [child]
        const mediaNodes = [...child.getChildren().filter($isMediaNode)]
        for (let j = i + 1; j < children.length; j++) {
          const n = children[j]
          if (!isMediaOnlyParagraph(n)) break
          run.push(n)
          mediaNodes.push(...n.getChildren().filter($isMediaNode))
        }

        if (mediaNodes.length < 2) {
          i += run.length - 1
          continue
        }

        const gallery = $createGalleryNode()
        run[0].insertBefore(gallery)

        for (const media of mediaNodes) gallery.append(media)
        for (const p of run) p.remove()

        i += run.length - 1
      }
    })
  }
})
