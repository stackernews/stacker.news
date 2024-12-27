import { visit, SKIP } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      let detailsNode = null
      let nodesToRemove = []
      let startIndex = null
      let currentParent = null

      visit(tree, (node, index, parent) => {
        // handle details and summary tags
        // Only process top-level nodes: avoid picking up nodes multiple times due to visiting descendants
        if (parent && parent !== tree) {
          return
        }

        // Start of details section
        if (node.type === 'raw' && node.value.includes('<details>')) {
          // Handle case where opening and closing tags are in same node
          if (node.value.includes('</details>')) {
            const [before, ...rest] = node.value.split('<details>')
            const [content, ...after] = rest.join('<details>').split('</details>')

            // Create the details node
            const newDetailsNode = {
              type: 'element',
              tagName: 'details',
              properties: {},
              children: []
            }

            // Process content for summary and remaining content
            const { summary, rest: remainingContent } = extractSummary(content)

            // Add summary if found
            if (summary) {
              newDetailsNode.children.push(createSummaryNode(summary))
            }

            // Add remaining content
            if (remainingContent) {
              newDetailsNode.children.push({
                type: 'text',
                value: remainingContent
              })
            }

            // Replace the current node with: before + details + after
            const replacementNodes = []

            if (before.trim()) {
              replacementNodes.push({
                type: 'text',
                value: before.trim()
              })
            }

            replacementNodes.push(newDetailsNode)

            if (after.join('</details>').trim()) {
              replacementNodes.push({
                type: 'text',
                value: after.join('</details>').trim()
              })
            }

            parent.children.splice(index, 1, ...replacementNodes)
            return SKIP
          }

          // Start collecting nodes for a new details section
          detailsNode = {
            type: 'element',
            tagName: 'details',
            properties: {},
            children: []
          }
          startIndex = index
          currentParent = parent
          nodesToRemove = [node]

          // Handle any content after the opening tag
          const [, ...rest] = node.value.split('<details>')
          const afterTag = rest.join('<details>')
          if (afterTag.trim()) {
            // Check for summary in the opening tag content
            const { summary, rest: remainingContent } = extractSummary(afterTag)

            if (summary) {
              detailsNode.children.push(createSummaryNode(summary))
            }

            if (remainingContent) {
              detailsNode.children.push({
                type: 'text',
                value: remainingContent
              })
            }
          }

          return
        }

        // End of details section
        if (detailsNode && node.type === 'raw' && node.value.includes('</details>')) {
          const [beforeClose, ...rest] = node.value.split('</details>')

          if (beforeClose.trim()) {
            // Check for summary in the closing content if no summary exists yet
            if (!detailsNode.children.some(child => child.tagName === 'summary')) {
              const { summary, rest: remainingContent } = extractSummary(beforeClose)

              if (summary) {
                detailsNode.children.unshift(createSummaryNode(summary))
              }

              if (remainingContent) {
                detailsNode.children.push({
                  type: 'text',
                  value: remainingContent
                })
              }
            } else {
              // No summary needed, just add content
              detailsNode.children.push({
                type: 'text',
                value: beforeClose.trim()
              })
            }
          }

          nodesToRemove.push(node)

          // Replace all collected nodes with the details node
          currentParent.children.splice(startIndex, nodesToRemove.length, detailsNode)

          // Add any remaining content after the closing tag
          if (rest.length && rest.join('</details>').trim()) {
            currentParent.children.splice(startIndex + 1, 0, {
              type: 'text',
              value: rest.join('</details>').trim()
            })
          }

          // Reset collection state
          detailsNode = null
          nodesToRemove = []
          startIndex = null
          currentParent = null

          return SKIP
        }

        // Collect nodes between details tags
        if (detailsNode) {
          if (node.type === 'raw' && node.value.includes('<summary>')) {
            // Process summary node
            const { summary, rest: remainingContent } = extractSummary(node.value)

            if (summary) {
              // Add summary to start of details if none exists yet
              if (!detailsNode.children.some(child => child.tagName === 'summary')) {
                detailsNode.children.unshift(createSummaryNode(summary))
              }

              // Add remaining content if any
              if (remainingContent) {
                detailsNode.children.push({
                  type: 'text',
                  value: remainingContent
                })
              }
            } else {
              // No summary found, add as normal node
              detailsNode.children.push(node)
            }
          } else {
            // Not a summary node, add as normal
            detailsNode.children.push(node)
          }

          nodesToRemove.push(node)
          return SKIP
        }

        // Handle inline code property
        if (node.tagName === 'code') {
          node.properties.inline = !(parent && parent.tagName === 'pre')
        }

        // handle headings
        if (node.type === 'element' && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName) && !node.properties.id) {
          const nodeText = toString(node)
          const headingId = slug(nodeText.replace(/[^\w\-\s]+/gi, ''))
          node.properties.id = headingId

          // Create a new link element
          const linkElement = {
            type: 'element',
            tagName: 'headlink',
            properties: {
              href: `#${headingId}`
            },
            children: [{ type: 'text', value: nodeText }]
          }

          // Replace the heading's children with the new link element
          node.children = [linkElement]
          return [SKIP]
        }

        // if img is wrapped in a link, remove the link
        if (node.tagName === 'a' && node.children.length === 1 && node.children[0].tagName === 'img') {
          parent.children[index] = node.children[0]
          return index
        }

        // handle internal links
        if (node.tagName === 'a') {
          try {
            if (node.properties.href.includes('#itemfn-')) {
              node.tagName = 'footnote'
            } else {
              const { itemId, linkText } = parseInternalLinks(node.properties.href)
              if (itemId) {
                node.tagName = 'item'
                node.properties.id = itemId
                if (node.properties.href === toString(node)) {
                  node.children[0].value = linkText
                }
              }
            }
          } catch {
            // ignore errors like invalid URLs
          }
        }

        // only show a link as an embed if it doesn't have text siblings
        if (node.tagName === 'a' &&
                  !parent.children.some(s => s.type === 'text' && s.value.trim()) &&
                  toString(node) === node.properties.href) {
          const embed = parseEmbedUrl(node.properties.href)
          if (embed) {
            node.tagName = 'embed'
            node.properties = { ...embed, src: node.properties.href }
          } else {
            node.tagName = 'autolink'
          }
        }

        // if the link text is a URL, just show the URL
        if (node.tagName === 'a' && isMisleadingLink(toString(node), node.properties.href)) {
          node.children = [{ type: 'text', value: node.properties.href }]
          return [SKIP]
        }

        // Handle @mentions and ~subs
        if (node.type === 'text') {
          const newChildren = []
          let lastIndex = 0
          let match
          let childrenConsumed = 1
          let text = toString(node)

          const combinedRegex = new RegExp(mentionRegex.source + '|' + subRegex.source, 'gi')

          // handle @__username__ or ~__sub__
          if (['@', '~'].includes(node.value) &&
            parent.children[index + 1]?.tagName === 'strong' &&
            parent.children[index + 1].children[0]?.type === 'text') {
            childrenConsumed = 2
            text = node.value + '__' + toString(parent.children[index + 1]) + '__'
          }

          while ((match = combinedRegex.exec(text)) !== null) {
            if (lastIndex < match.index) {
              newChildren.push({ type: 'text', value: text.slice(lastIndex, match.index) })
            }

            const [fullMatch, mentionMatch, subMatch] = match
            const replacement = mentionMatch ? replaceMention(fullMatch, mentionMatch) : replaceSub(fullMatch, subMatch)

            if (replacement) {
              newChildren.push(replacement)
            } else {
              newChildren.push({ type: 'text', value: fullMatch })
            }

            lastIndex = combinedRegex.lastIndex
          }

          if (newChildren.length > 0) {
            if (lastIndex < text.length) {
              newChildren.push({ type: 'text', value: text.slice(lastIndex) })
            }
            parent.children.splice(index, childrenConsumed, ...newChildren)
            return index + newChildren.length
          }
        }
        // Handle Nostr IDs
        if (node.type === 'text') {
          const newChildren = []
          let lastIndex = 0
          let match

          while ((match = nostrIdRegex.exec(node.value)) !== null) {
            if (lastIndex < match.index) {
              newChildren.push({ type: 'text', value: node.value.slice(lastIndex, match.index) })
            }

            newChildren.push(replaceNostrId(match[0], match[0]))

            lastIndex = nostrIdRegex.lastIndex
          }

          if (lastIndex < node.value.length) {
            newChildren.push({ type: 'text', value: node.value.slice(lastIndex) })
          }

          if (newChildren.length > 0) {
            parent.children.splice(index, 1, ...newChildren)
            return index + newChildren.length
          }
        }
        // handle custom tags
        if (node.type === 'element') {
          for (const { startTag, endTag, className } of stylers) {
            for (let i = 0; i < node.children.length - 2; i++) {
              const [start, text, end] = node.children.slice(i, i + 3)

              if (start?.type === 'raw' && start?.value === startTag &&
                  text?.type === 'text' &&
                  end?.type === 'raw' && end?.value === endTag) {
                const newChild = {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: [className] },
                  children: [{ type: 'text', value: text.value }]
                }
                node.children.splice(i, 3, newChild)
              }
            }
          }
        }
        // merge adjacent images and empty paragraphs into a single image collage
        if ((node.tagName === 'img' || isImageOnlyParagraph(node)) && Array.isArray(parent.children)) {
          const adjacentNodes = [node]
          let nextIndex = index + 1
          const siblings = parent.children
          const somethingBefore = parent.children[index - 1] && parent.children[index - 1].tagName !== 'p'
          let somethingAfter = false

          while (nextIndex < siblings.length) {
            const nextNode = siblings[nextIndex]
            if (!nextNode) break
            if (nextNode.tagName === 'img' || isImageOnlyParagraph(nextNode)) {
              adjacentNodes.push(nextNode)
              nextIndex++
            } else if (nextNode.type === 'text' && typeof nextNode.value === 'string' && !nextNode.value.trim()) {
              nextIndex++
            } else {
              somethingAfter = true
              break
            }
          }

          if (adjacentNodes.length > 0) {
            const allImages = adjacentNodes.flatMap(n =>
              n.tagName === 'img' ? [n] : (Array.isArray(n.children) ? n.children.filter(child => child.tagName === 'img') : [])
            )
            const collageNode = {
              type: 'element',
              tagName: 'p',
              children: allImages,
              properties: { onlyImages: true, somethingBefore, somethingAfter }
            }
            parent.children.splice(index, nextIndex - index, collageNode)
            return index + 1
          }
        }
      })
    } catch (error) {
      console.error('Error in rehypeSN transformer:', error)
    }

    return tree
  }
  function isImageOnlyParagraph (node) {
    return node &&
        node.tagName === 'p' &&
        Array.isArray(node.children) &&
        node.children.every(child =>
          (child.tagName === 'img') ||
          (child.type === 'text' && typeof child.value === 'string' && !child.value.trim())
        )
  }

  function replaceMention (value, username) {
    return {
      type: 'element',
      tagName: 'mention',
      properties: { href: '/' + username, name: username },
      children: [{ type: 'text', value }]
    }
  }

  function replaceSub (value, sub) {
    return {
      type: 'element',
      tagName: 'sub',
      properties: { href: '/~' + sub, name: sub },
      children: [{ type: 'text', value }]
    }
  }

  function isMisleadingLink (text, href) {
    let misleading = false

    if (/^\s*(\w+\.)+\w+/.test(text)) {
      try {
        const hrefUrl = new URL(href)

        if (new URL(hrefUrl.protocol + text).origin !== hrefUrl.origin) {
          misleading = true
        }
      } catch {}
    }

    return misleading
  }

  function replaceNostrId (value, id) {
    return {
      type: 'element',
      tagName: 'a',
      properties: { href: `https://njump.me/${id}` },
      children: [{ type: 'text', value }]
    }
  }
  // Helper function to create a summary node
  function createSummaryNode (content) {
    return {
      type: 'element',
      tagName: 'summary',
      properties: {},
      children: [{
        type: 'text',
        value: content.trim()
      }]
    }
  }

  // Helper function to extract summary content
  function extractSummary (content) {
    if (!content.includes('<summary>')) return { summary: null, rest: content }

    const [before, ...afterOpen] = content.split('<summary>')
    const [summaryContent, ...afterClose] = afterOpen.join('<summary>').split('</summary>')

    return {
      summary: summaryContent.trim(),
      rest: (before + afterClose.join('</summary>')).trim()
    }
  }
}
