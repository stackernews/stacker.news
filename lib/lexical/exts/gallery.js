import { defineExtension, $isParagraphNode, RootNode } from 'lexical'
import { $createGalleryNode, $isGalleryNode } from '@/lib/lexical/nodes/content/gallery'
import { $isMediaNode } from '@/lib/lexical/nodes/content/media'

/** checks if a paragraph only contains non-autolink MediaNodes */
function isMediaOnlyParagraph (node) {
  if (!$isParagraphNode(node)) return false
  const children = node.getChildren()
  if (children.length === 0) return false
  return children.every(child => {
    return $isMediaNode(child) && !child.isAutolink()
  })
}

/** collects adjacent media-only paragraphs starting from index i */
function collectAdjacentMediaParagraphs (children, startIndex) {
  const paragraphs = []
  for (let i = startIndex; i < children.length; i++) {
    const child = children[i]
    if ($isGalleryNode(child) || !isMediaOnlyParagraph(child)) break
    paragraphs.push(child)
  }
  return paragraphs
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

        // collect all adjacent media-only paragraphs
        const paragraphs = collectAdjacentMediaParagraphs(children, i)

        // extract all media nodes from the paragraphs.
        // as we can face nested arrays of paragraphs,
        // we need to flatten them into a single array of media nodes
        const mediaNodes = paragraphs.flatMap(p => p.getChildren().filter($isMediaNode))

        if (mediaNodes.length < 2) {
          i += paragraphs.length - 1
          continue
        }

        const gallery = $createGalleryNode()
        paragraphs[0].insertBefore(gallery)

        for (const media of mediaNodes) gallery.append(media)
        for (const p of paragraphs) p.remove()

        i += paragraphs.length - 1
      }
    })
  }
})
