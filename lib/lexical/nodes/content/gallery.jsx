import { ElementNode, $applyNodeReplacement } from 'lexical'

function $convertGalleryElement (domNode) {
  if (!domNode.hasAttribute('data-lexical-gallery')) return null
  const node = $createGalleryNode()
  return { node }
}

/** base element shared by createDOM and exportDOM; the data attribute lets
 * the node be reconstructed from HTML into Lexical (see $convertGalleryElement) */
function createGalleryElement () {
  const div = document.createElement('div')
  div.setAttribute('class', 'sn-gallery')
  div.setAttribute('data-lexical-gallery', 'true')
  return div
}

export class GalleryNode extends ElementNode {
  $config () {
    return this.config('gallery', {
      extends: ElementNode
    })
  }

  static clone (node) {
    return new GalleryNode(node.__key)
  }

  createDOM (config) {
    const div = createGalleryElement()
    div.contentEditable = 'false'
    return div
  }

  exportDOM () {
    return { element: createGalleryElement() }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-gallery')) return null
        return { conversion: $convertGalleryElement, priority: 2 }
      }
    }
  }

  static importJSON (serializedNode) {
    return $createGalleryNode()
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'gallery'
    }
  }

  isInline () {
    return false
  }

  updateDOM () {
    return false
  }
}

export function $createGalleryNode () {
  return $applyNodeReplacement(new GalleryNode())
}

export function $isGalleryNode (node) {
  return node instanceof GalleryNode
}
