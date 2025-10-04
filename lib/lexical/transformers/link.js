import { LinkNode, $isLinkNode, $createLinkNode, $isAutoLinkNode } from '@lexical/link'
import { $createTextNode } from 'lexical'

// from default link transformer
// with a different regexp to avoid expanding the transformable range
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
  importRegExp: /(?:\[([^[]*)\])(?:\(([^)]+)\))/,
  regExp: /(?:\[([^[]*)\])(?:\(([^)]+)\))$/,
  replace: (textNode, match) => {
    const [, linkText, linkUrl, linkTitle] = match
    const linkNode = $createLinkNode(linkUrl, {
      title: linkTitle
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
