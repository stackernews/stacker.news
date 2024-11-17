import { SKIP, visit } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g
const detailsRegex = /<details>([\s\S]*?)<\/details>/
const summaryRegex = /<summary>([\s\S]*?)<\/summary>/

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      visit(tree, (node, index, parent) => {
        // Process details/summary tags first to ensure proper node structure
        if (node.type === 'raw' && parent?.children) {
          // Check for incomplete details tags that might be split across nodes
          if (node.value.includes('<details') && !node.value.includes('</details>')) {
            let nextIndex = index + 1
            let content = node.value

            // Scan subsequent nodes until we find the closing details tag
            while (nextIndex < parent.children.length) {
              const nextNode = parent.children[nextIndex]
              
              if (nextNode.type === 'raw') {
                content += nextNode.value
                // Found closing tag - combine all nodes into one
                if (nextNode.value.includes('</details>')) {
                  node.value = content
                  // Remove the now-combined nodes from parent
                  parent.children.splice(index + 1, nextIndex - index)
                  // Don't skip - we still need to process the combined content
                  break
                }
              } else if (nextNode.type === 'text' || nextNode.type === 'element') {
                // Preserve content from text nodes and elements (like paragraphs)
                content += getTextContent(nextNode)
              }
              nextIndex++
            }
          }

          // Process details tags (both complete and newly-combined ones)
          const value = node.value.trim()
          if (value.includes('<details>')) {
            // Find all details blocks in this node
            const detailsMatches = Array.from(value.matchAll(/<details>\s*([\s\S]*?)\s*<\/details>/g))
            if (detailsMatches.length) {
              detailsMatches.forEach(match => {
                const content = match[1]
                // Extract summary content if present
                const summaryMatch = content.match(/<summary>([\s\S]*?)<\/summary>/)
                const summaryContent = summaryMatch
                  ? summaryMatch[1].trim()
                  : 'Details' // Default summary text

                // Get content after summary tag, or all content if no summary
                let remainingContent = summaryMatch
                  ? content.replace(summaryMatch[0], '').trim()
                  : content.trim()

                // Normalize markdown content
                remainingContent = normalizeMarkdown(remainingContent)

                // Convert markdown content to HTML structure
                const mdast = fromMarkdown(remainingContent)
                const contentHast = toHast(mdast)

                Object.assign(node, createDetailsNode(summaryContent, contentHast?.children ?? []))
              })
              return [SKIP]
            }
          }
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
          // Existing stylers handling
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

  /**
   * Extracts text content from any node type
   * Handles both direct text nodes and nested element structures
   */
  function getTextContent (node) {
    if (node.value) return node.value
    if (!node.children) return ''
    return node.children.map(child => getTextContent(child)).join('')
  }

  // Helper function to normalize markdown content
  function normalizeMarkdown(content) {
    return content
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .split('\n')                      // Split into lines
      .map(line => line.trim())         // Trim each line
      .join('\n\n')                     // Add blank line between all content
      .replace(/\n{3,}/g, '\n\n')       // Normalize multiple blank lines to two
      .trim()                           // Trim final result
  }

  // Helper function to create details node structure
  function createDetailsNode(summaryContent, children) {
    return {
      type: 'element',
      tagName: 'details',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'summary',
          properties: {},
          children: [{
            type: 'text',
            value: summaryContent
          }]
        },
        ...children
      ]
    }
  }
}
