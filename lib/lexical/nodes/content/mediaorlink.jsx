import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { IMG_URL_REGEXP, VIDEO_URL_REGEXP } from '@/lib/url'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

// Recognize if the link is a media or a link to a page
export class MediaOrLinkNode extends DecoratorNode {
  __src
  __rel
  __linkFallback
  __name

  static getType () {
    return 'mediaOrLink'
  }

  getSrc () {
    return this.__src
  }

  getTextContent () {
    return this.__src
  }

  getAltText () {
    return this.__name
  }

  // we need to have a real way to determine if the link is an image or a video or a link
  getInnerType () {
    if (IMG_URL_REGEXP.test(this.__src)) {
      return 'image'
    }
    if (VIDEO_URL_REGEXP.test(this.__src)) {
      return 'video'
    }
    return 'link'
  }

  static clone (node) {
    return new MediaOrLinkNode(
      node.__src,
      node.__rel,
      node.__linkFallback,
      node.__name,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    const { src, rel, linkFallback, name } = serializedNode
    return $createMediaOrLinkNode({ src, rel, linkFallback, name })
  }

  exportJSON () {
    return {
      type: 'mediaOrLink',
      version: 1,
      src: this.__src,
      rel: this.__rel,
      linkFallback: this.__linkFallback,
      name: this.__name
    }
  }

  static importDOM () {
    return {
      a: () => ({
        conversion: (node) => {
          if (node instanceof window.HTMLAnchorElement) {
            const href = node.getAttribute('href')
            if (!href) return null
            const rel = node.getAttribute('rel') || UNKNOWN_LINK_REL
            const name = node.getAttribute('alt') || ''
            return { node: $createMediaOrLinkNode({ src: href, rel, name }) }
          }
          return null
        },
        priority: 1
      })
    }
  }

  exportDOM () {
    const src = this.__src
    const name = this.__name
    const innerType = this.getInnerType()
    let element
    switch (innerType) {
      case 'image':
        element = document.createElement('img')
        element.setAttribute('src', src)
        element.setAttribute('alt', name)
        break
      case 'video':
        element = document.createElement('video')
        element.setAttribute('src', src)
        element.setAttribute('controls', '')
        break
      default:
        element = document.createElement('a')
        element.setAttribute('href', src)
        if (this.__rel) element.setAttribute('rel', this.__rel)
        element.setAttribute('target', '_blank')
        element.textContent = src
        break
    }
    return { element }
  }

  constructor (src, rel, linkFallback = true, name, key) {
    super(key)
    this.__src = src
    this.__rel = rel
    this.__linkFallback = linkFallback
    this.__name = name
  }

  createDOM () {
    return document.createElement('span')
  }

  updateDOM () {
    return false
  }

  decorate () {
    const MediaOrLink = require('@/components/media-or-link').default
    return (
      <MediaOrLink
        src={this.__src}
        rel={this.__rel}
        linkFallback={this.__linkFallback}
      />
    )
  }
}

export function $createMediaOrLinkNode ({ src, rel, linkFallback = true, name, key }) {
  return $applyNodeReplacement(
    new MediaOrLinkNode(src, rel, linkFallback, name, key)
  )
}

export function $isMediaOrLinkNode (node) {
  return node instanceof MediaOrLinkNode
}
