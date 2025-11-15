import { $createTextNode } from 'lexical'
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, LinkNode } from '@lexical/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'

/** link transformer
 *
 *  rich mode: gets a link node and creates the appropriate markdown equivalent
 *
 *  markdown mode: from \[text](url) to link node
 *
 */
export const LINK = {
  dependencies: [LinkNode],
  export: (node, exportChildren, exportFormat) => {
    if (!$isLinkNode(node) || $isAutoLinkNode(node)) {
      return null
    }
    const title = node.getTitle()
    const textContent = exportChildren(node)
    const linkContent = title ? `[${textContent}](${node.getURL()} "${title}")` : `[${textContent}](${node.getURL()})`
    return linkContent
  },
  // also supports unicode characters
  importRegExp: /(?:\[((?:[^\]]|\[(?:[^\]])*\])*)\])(?:\(([^)]+)\))/u,
  regExp: /(?:\[((?:[^\]]|\[(?:[^\]])*\])*)\])(?:\(([^)]+)\))$/u,
  replace: (textNode, match) => {
    const [, linkText, linkUrl] = match
    const linkNode = $createLinkNode(linkUrl, {
      title: linkText,
      target: '_blank',
      rel: UNKNOWN_LINK_REL
    })
    const openBracketAmount = linkText.split('[').length - 1
    const closeBracketAmount = linkText.split(']').length - 1
    let parsedLinkText = linkText
    let outsideLinkText = ''
    if (openBracketAmount < closeBracketAmount) {
      return
    } else if (openBracketAmount > closeBracketAmount) {
      const linkTextParts = linkText.split('[')
      outsideLinkText = '[' + linkTextParts[0]
      parsedLinkText = linkTextParts.slice(1).join('[')
    }
    const linkTextNode = $createTextNode(parsedLinkText)
    linkTextNode.setFormat(textNode.getFormat())
    linkNode.append(linkTextNode)
    textNode.replace(linkNode)
    if (outsideLinkText) {
      linkNode.insertBefore($createTextNode(outsideLinkText))
    }
    return linkTextNode
  },
  trigger: ')',
  type: 'text-match'
}
