import { $createTextNode } from 'lexical'
import { $createLinkNode, $isLinkNode, $isAutoLinkNode } from '@lexical/link'

const NOSTR_ID_PATTERN = /^((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)$/
const NJUMP_ORIGIN = 'https://njump.to'

function isNostrIdLink (lexicalNode) {
  const url = lexicalNode.getURL?.()
  if (!url) return null

  try {
    const u = new URL(url)
    if (u.origin !== NJUMP_ORIGIN) return null
    if (u.search || u.hash) return null
    const id = u.pathname.replace(/^\//, '')
    if (!id) return null
    if (!NOSTR_ID_PATTERN.test(id)) return null

    // only convert back to nostrId markdown if the visible text is exactly the id
    const text = lexicalNode.getTextContent?.()
    if (text !== id) return null

    return id
  } catch {
    return null
  }
}

// mdast -> lexical
export const MdastNostrIdVisitor = {
  testNode: 'nostrId',
  visitNode ({ mdastNode, actions }) {
    const url = `${NJUMP_ORIGIN}/${mdastNode.value}`
    const link = $createLinkNode(url, {
      target: '_blank',
      rel: 'noopener nofollow noreferrer'
    })
    link.append($createTextNode(mdastNode.value))
    actions.addAndStepInto(link)
  }
}

// lexical -> mdast
export const LexicalNostrIdVisitor = {
  testLexicalNode: (node) => $isLinkNode(node) || $isAutoLinkNode(node),
  priority: 30,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    const id = isNostrIdLink(lexicalNode)
    if (!id) {
      actions.nextVisitor()
      return
    }
    actions.appendToParent(mdastParent, {
      type: 'nostrId',
      value: id
    })
  },
  mdastType: 'nostrId',
  toMarkdown (node) {
    return node.value
  }
}
