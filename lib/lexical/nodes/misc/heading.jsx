import { HeadingNode } from '@lexical/rich-text'
import { slug } from 'github-slugger'
import { setNodeIndentFromDOM, $applyNodeReplacement, $createParagraphNode, $isTextNode, $isLineBreakNode } from 'lexical'

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
// identifies the decorative anchor link; the sn-heading__link class is styling only
const HEADING_LINK_ATTRIBUTE = 'data-lexical-heading-link'

function $convertSNHeadingElement (element) {
  const tag = element.nodeName.toLowerCase()
  if (!HEADING_TAGS.includes(tag)) return null

  const node = $createSNHeadingNode(tag)
  if (element.style !== null) {
    setNodeIndentFromDOM(element, node)
    node.setFormat(element.style.textAlign)
  }

  return { node }
}

// from Lexical's HeadingNode
function isGoogleDocsTitle (domNode) {
  if (domNode.nodeName.toLowerCase() === 'span') {
    return domNode.style.fontSize === '26pt'
  }
  return false
}

// empty anchor; the reconciler (getDOMSlot) / exportDOM (append) fill it with the
// heading's children so the whole heading becomes a permalink
function createHeadingAnchorLink (domElement, headingId) {
  const doc = domElement.ownerDocument
  const link = doc.createElement('a')
  link.setAttribute(HEADING_LINK_ATTRIBUTE, 'true')
  link.className = 'sn-heading__link'
  link.setAttribute('href', `#${headingId}`)
  return link
}

function setHeadingId (domElement, headingId) {
  if (headingId) domElement.setAttribute('id', headingId)
  else domElement.removeAttribute('id')
}

// returns the anchor element if this heading is rendered as a permalink, null otherwise
function getHeadingAnchorLink (domElement) {
  const first = domElement.firstChild
  return first && first.nodeName === 'A' && first.hasAttribute(HEADING_LINK_ATTRIBUTE) ? first : null
}

// a heading is only wrapped in an anchor when its content is plain text
function $headingHasOnlyTextContent (node) {
  return node.getChildren().every(child => $isTextNode(child) || $isLineBreakNode(child))
}

// re-implements HeadingNode with slug support
export class SNHeadingNode extends HeadingNode {
  static getType () {
    return 'sn-heading'
  }

  static clone (node) {
    return new SNHeadingNode(node.__tag, node.__key)
  }

  getSlug () {
    return slug(this.getTextContent().replace(/[^\w\-\s]+/gi, ''))
  }

  // headings are not links by default, because lexical creates a span
  // so if we were to append a link to the element, it would render as sibling
  // instead of wrapping the text in a link.
  createDOM (config, editor) {
    const element = super.createDOM(config, editor)
    // anchor navigation
    const headingId = this.getSlug()
    if (headingId) {
      setHeadingId(element, headingId)

      // in read mode, wrap the heading text in a real anchor (filled by getDOMSlot)
      if (editor && !editor.isEditable() && $headingHasOnlyTextContent(this)) {
        element.appendChild(createHeadingAnchorLink(element, headingId))
      }
    }

    return element
  }

  // route the heading's children into the anchor wrapper when present, so the
  // reconciler reconciles them inside the <a> instead of directly in the <hN>
  getDOMSlot (element) {
    const link = getHeadingAnchorLink(element)
    const slot = super.getDOMSlot(element)
    return link ? slot.withElement(link) : slot
  }

  // update ID (and the anchor href) on content changes
  updateDOM (prevNode, dom, config) {
    const prevSlug = prevNode.getSlug()
    const currentSlug = this.getSlug()
    if (prevSlug !== currentSlug) {
      setHeadingId(dom, currentSlug)
      const link = getHeadingAnchorLink(dom)
      if (link) link.setAttribute('href', `#${currentSlug}`)
    }
    return super.updateDOM(prevNode, dom, config)
  }

  exportDOM (editor) {
    const { element } = super.exportDOM(editor)
    const headingId = this.getSlug()

    if (!headingId) return { element }
    setHeadingId(element, headingId)

    // keep the SSR HTML placeholder aligned with the reader
    if (!$headingHasOnlyTextContent(this)) return { element }
    const link = createHeadingAnchorLink(element, headingId)
    element.appendChild(link)
    return { element, append: (fragment) => link.append(fragment) }
  }

  // override
  insertNewAfter (selection, restoreSelection = true) {
    const anchorOffset = selection ? selection.anchor.offset : 0
    const lastDesc = this.getLastDescendant()
    const isAtEnd = !lastDesc || (selection && selection.anchor.key === lastDesc.getKey() && anchorOffset === lastDesc.getTextContentSize())
    const newElement = isAtEnd || !selection ? $createParagraphNode() : $createSNHeadingNode(this.getTag())
    const direction = this.getDirection()
    newElement.setDirection(direction)
    this.insertAfter(newElement, restoreSelection)
    if (anchorOffset === 0 && !this.isEmpty() && selection) {
      const paragraph = $createParagraphNode()
      paragraph.select()
      this.replace(paragraph, true)
    }
    return newElement
  }

  // override
  collapseAtStart () {
    const newElement = !this.isEmpty() ? $createSNHeadingNode(this.getTag()) : $createParagraphNode()
    const children = this.getChildren()
    children.forEach(child => newElement.append(child))
    this.replace(newElement)
    return true
  }

  // override
  static importJSON (serializedNode) {
    return $createSNHeadingNode(serializedNode.tag).updateFromJSON(serializedNode)
  }

  static importDOM () {
    const headingConverters = Object.fromEntries(
      HEADING_TAGS.map(tag => [
        tag,
        () => ({
          conversion: $convertSNHeadingElement,
          priority: 0
        })
      ])
    )

    return {
      ...headingConverters,
      // the reader wraps heading text in a decorative permalink anchor (createDOM,
      // read-only) that is not part of the editor state. Unwrap it on import, drop
      // the <a> but keep its text children (they hoist into the heading), so HTML
      // doesn't round-trip into a real link node.
      // runs regardless of which heading converter created the parent.
      a: node => {
        if (!node.hasAttribute(HEADING_LINK_ATTRIBUTE)) return null
        return {
          conversion: () => ({ node: null }),
          priority: 3
        }
      },
      p: node => {
        const paragraph = node
        const firstChild = paragraph.firstChild
        if (firstChild !== null && isGoogleDocsTitle(firstChild)) {
          return {
            conversion: () => ({ node: null }),
            priority: 3
          }
        }
        return null
      },
      span: node => {
        if (isGoogleDocsTitle(node)) {
          return {
            conversion: () => ({ node: $createSNHeadingNode('h1') }),
            priority: 3
          }
        }
        return null
      }
    }
  }
}

// will also be used internally by Lexical, signature should then match HeadingNode
export function $createSNHeadingNode (tag = 'h1') {
  return $applyNodeReplacement(new SNHeadingNode(tag))
}

export function $isSNHeadingNode (node) {
  return node instanceof SNHeadingNode
}
