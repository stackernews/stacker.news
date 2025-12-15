import { $createTextNode } from 'lexical'
import { $createLinkNode, $isLinkNode, $createAutoLinkNode, $isAutoLinkNode } from '@lexical/link'
import { $isEmbedNode } from '@/lib/lexical/nodes/content/embed'

const PRIORITIES = {
  AUTO_LINK: 25,
  ITEM_MENTION: 20,
  EMBED: 15,
  MEDIA: 10
}

// check if link is a "bare link" (text matches url)
function isBareLink (mdastNode) {
  const linkText = mdastNode.children?.[0]?.value
  return linkText === mdastNode.url
}

export const MdastAutolinkVisitor = {
  testNode: 'link',
  priority: PRIORITIES.AUTO_LINK,
  visitNode ({ mdastNode, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()
      return
    }

    actions.addAndStepInto($createAutoLinkNode(mdastNode.url))
  }
}

// regular link (default priority)
export const MdastLinkVisitor = {
  testNode: 'link',
  visitNode ({ mdastNode, actions }) {
    const link = $createLinkNode(mdastNode.url, {
      title: mdastNode.title,
      target: mdastNode.target === null ? '' : (mdastNode.target || '_blank'),
      rel: mdastNode.rel === null ? '' : (mdastNode.rel || 'noopener nofollow noreferrer')
    })

    // if no children, use url as text
    if (!mdastNode.children?.length) {
      link.append($createTextNode(mdastNode.url))
    }

    actions.addAndStepInto(link)
  }
}

// lexical -> mdast: regular link
export const LexicalLinkVisitor = {
  testLexicalNode: (node) => $isLinkNode(node) || $isAutoLinkNode(node),
  visitLexicalNode ({ lexicalNode, actions }) {
    actions.addAndStepInto('link', {
      url: lexicalNode.getURL(),
      title: lexicalNode.getTitle()
    })
  }
}

// lexical -> mdast: embed outputs plain text url
export const LexicalEmbedVisitor = {
  testLexicalNode: $isEmbedNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'text',
      value: lexicalNode.getSrc() || ''
    })
  }
}
