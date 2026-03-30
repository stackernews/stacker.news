import { $createMediaNode, $isMediaNode } from '@/lib/lexical/nodes/content/media'
import { $isGalleryNode } from '@/lib/lexical/nodes/content/gallery'

// mdast -> lexical: image
export const MdastImageVisitor = {
  testNode: 'image',
  visitNode ({ mdastNode, actions }) {
    const node = $createMediaNode({
      src: mdastNode.url,
      alt: mdastNode.alt || '',
      title: mdastNode.title || ''
    })
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast: media outputs image syntax
// if the media is an autolink, we output the plain text url
export const LexicalMediaVisitor = {
  testLexicalNode: $isMediaNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    if (lexicalNode.isAutolink() && lexicalNode.getKind() === 'unknown') {
      return actions.appendToParent(mdastParent, {
        type: 'text',
        value: lexicalNode.getSrc()
      })
    }

    actions.appendToParent(mdastParent, {
      type: 'image',
      url: lexicalNode.getSrc() || '',
      alt: lexicalNode.getAlt() || '',
      title: lexicalNode.getTitle() || ''
    })
  }
}

// lexical -> mdast: gallery outputs paragraph syntax
// a GalleryNode is a wrapper for MediaNodes
// usually a MediaNode is wrapped in a ParagraphNode, but in this case it is not
// we need to extract MediaNodes, wrap them in a paragraph and add them to the mdast parent
export const LexicalGalleryVisitor = {
  testLexicalNode: $isGalleryNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const children = lexicalNode.getChildren()
    children.forEach((child) => {
      if ($isMediaNode(child)) {
        const paragraph = { type: 'paragraph', children: [] }
        actions.appendToParent(mdastParent, paragraph)
        actions.visit(child, paragraph)
      }
    })
  }
}
