import { defineExtension, $isParagraphNode, RootNode } from 'lexical'
import { $createGalleryNode, $isGalleryNode } from '@/lib/lexical/nodes/content/gallery'
import { $isMediaNode } from '@/lib/lexical/nodes/content/media'

/** checks if a paragraph only contains non-autolink MediaNodes */
function isMediaOnlyParagraph (node) {
  if (!$isParagraphNode(node)) return false
  const children = node.getChildren()
  if (children.length === 0) return false
  return children.every(child => {
    return $isMediaNode(child) && !child.isAutolink() && child.getKind() !== 'unknown'
  })
}

/** collects adjacent galleries and media-only paragraphs starting from index i */
function collectAdjacentGalleriesAndMedia (children, startIndex) {
  const collected = []
  for (let i = startIndex; i < children.length; i++) {
    const child = children[i]
    if ($isGalleryNode(child)) {
      collected.push({ type: 'gallery', node: child })
    } else if (isMediaOnlyParagraph(child)) {
      collected.push({ type: 'paragraph', node: child })
    } else {
      break
    }
  }
  return collected
}

export const GalleryExtension = defineExtension({
  name: 'GalleryExtension',
  register: (editor) => {
    return editor.registerNodeTransform(RootNode, (root) => {
      const children = root.getChildren()

      // adjacent paragraphs that only contain a MediaNode should be wrapped in a GalleryNode
      // existing galleries should merge with adjacent media-only paragraphs
      for (let i = 0; i < children.length; i++) {
        const child = children[i]

        // skip if not a gallery or media-only paragraph
        if (!$isGalleryNode(child) && !isMediaOnlyParagraph(child)) continue

        // collect all adjacent galleries and media-only paragraphs
        const collected = collectAdjacentGalleriesAndMedia(children, i)

        const galleries = collected.filter(c => c.type === 'gallery')
        const paragraphs = collected.filter(c => c.type === 'paragraph')

        // if no paragraphs, nothing new to merge
        if (paragraphs.length === 0) {
          i += collected.length - 1
          continue
        }

        // if no existing gallery, need at least 2 media total to create one
        if (galleries.length === 0) {
          const totalMedia = paragraphs.reduce((sum, p) =>
            sum + p.node.getChildren().filter($isMediaNode).length, 0)
          if (totalMedia < 2) {
            i += collected.length - 1
            continue
          }
        }

        // use existing gallery or create new one
        let gallery
        if (galleries.length > 0) {
          gallery = galleries[0].node
        } else {
          gallery = $createGalleryNode()
          collected[0].node.insertBefore(gallery)
        }

        // merge all media into the gallery
        for (const item of collected) {
          if (item.node !== gallery) {
            const mediaNodes = item.node.getChildren().filter($isMediaNode)
            for (const media of mediaNodes) gallery.append(media)
            item.node.remove()
          }
        }

        i += collected.length - 1
      }
    })
  }
})
