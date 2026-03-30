import { HeadingNode } from '@lexical/rich-text'
import { slug } from 'github-slugger'
import { setNodeIndentFromDOM, $applyNodeReplacement, $createParagraphNode } from 'lexical'

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

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

function createHeadingAnchorLink (domElement, headingId, textContent) {
  const doc = domElement.ownerDocument
  const link = doc.createElement('a')
  link.className = 'sn-heading__link'
  link.setAttribute('href', `#${headingId}`)
  link.textContent = textContent
  return link
}

function setHeadingId (domElement, headingId) {
  if (headingId) domElement.setAttribute('id', headingId)
  else domElement.removeAttribute('id')
}

function tryUpdateHeadingAnchorLink (domElement, headingId, textContent) {
  const first = domElement.firstChild
  if (first && first.nodeName === 'A' && first.classList?.contains('sn-heading__link')) {
    first.setAttribute('href', `#${headingId}`)
    first.textContent = textContent
    return true
  }
  return false
}

function upsertHeadingAnchorLink (domElement, headingId, textContent) {
  if (tryUpdateHeadingAnchorLink(domElement, headingId, textContent)) return
  domElement.insertBefore(createHeadingAnchorLink(domElement, headingId, textContent), domElement.firstChild)
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
  // the workaround used here is to use CSS to make this clickable.
  createDOM (config, editor) {
    const element = super.createDOM(config, editor)
    // anchor navigation
    const headingId = this.getSlug()
    if (headingId) {
      setHeadingId(element, headingId)

      if (editor && !editor.isEditable()) {
        upsertHeadingAnchorLink(element, headingId, this.getTextContent())
      }
    }

    return element
  }

  updateDOM (prevNode, dom, config) {
    // update ID on content changes
    const prevSlug = prevNode.getSlug()
    const currentSlug = this.getSlug()
    if (prevSlug !== currentSlug) {
      setHeadingId(dom, currentSlug)
      tryUpdateHeadingAnchorLink(dom, currentSlug, this.getTextContent())
    }
    return super.updateDOM(prevNode, dom, config)
  }

  exportDOM (editor) {
    const { element } = super.exportDOM(editor)
    const headingId = this.getSlug()

    if (headingId) {
      setHeadingId(element, headingId)
      upsertHeadingAnchorLink(element, headingId, this.getTextContent())
    }

    return { element }
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
