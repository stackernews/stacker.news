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
const detailsRegex = /<details>\s*([\s\S]*?)\s*<\/details>/
const summaryRegex = /<summary>([\s\S]*?)<\/summary>/

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      // First pass: find and combine split details tags
      // This handles cases where blank lines cause the parser to split nodes
      visit(tree, (node, index, parent) => {
        if (node.type === 'raw' && parent?.children) {
          // Look for details tags that are incomplete (no closing tag)
          if (node.value.includes('<details') && !node.value.includes('</details>')) {
            let nextIndex = index + 1
            let content = node.value

            // Keep looking through subsequent nodes until we find the closing tag
            while (nextIndex < parent.children.length) {
              const nextNode = parent.children[nextIndex]
              
              // Handle different types of content nodes
              if (nextNode.type === 'raw') {
                content += nextNode.value
                // Found the closing tag - combine all nodes and stop
                if (nextNode.value.includes('</details>')) {
                  node.value = content
                  // Remove the now-combined nodes
                  parent.children.splice(index + 1, nextIndex - index)
                  return [SKIP]
                }
              } else if (nextNode.type === 'text' || nextNode.type === 'element') {
                // Preserve content from text nodes and elements
                content += getTextContent(nextNode)
              }
              nextIndex++
            }
          }
        }
      })

      // Second pass: process details tags into proper HTML structure
      visit(tree, (node) => {
        if (node.type === 'raw') {
          const value = node.value.trim()

          // Only process nodes containing complete details tags
          if (value.includes('<details>')) {
            // Find all details blocks in the content
            const detailsMatches = Array.from(value.matchAll(/<details>\s*([\s\S]*?)\s*<\/details>/g))
            if (!detailsMatches.length) return

            detailsMatches.forEach(match => {
              const content = match[1]
              
              // Extract summary content if present, or use default
              const summaryMatch = content.match(/<summary>([\s\S]*?)<\/summary>/)
              const summaryContent = summaryMatch
                ? summaryMatch[1].trim()
                : 'Details'

              // Get remaining content after summary
              let remainingContent = summaryMatch
                ? content.replace(summaryMatch[0], '').trim()
                : content.trim()

              // Normalize newlines for consistent rendering
              remainingContent = remainingContent
                .replace(/\r\n/g, '\n')
                .replace(/\n\s*\n/g, '\n\n')
                .trim()

              // Convert markdown content to HTML structure
              const mdast = fromMarkdown(remainingContent)
              const contentHast = toHast(mdast)

              // Create the details node structure
              const summaryNode = {
                type: 'element',
                tagName: 'summary',
                properties: {},
                children: [{
                  type: 'text',
                  value: summaryContent
                }]
              }

              const detailsNode = {
                type: 'element',
                tagName: 'details',
                properties: {},
                children: [
                  summaryNode,
                  ...(contentHast?.children ?? [])
                ]
              }

              // Replace the original node with our structured version
              Object.assign(node, detailsNode)
            })

            return [SKIP]
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
}

// Helper function to extract text content from nodes
function getTextContent(node) {
  if (node.value) return node.value
  if (!node.children) return ''
  return node.children.map(child => getTextContent(child)).join('')
}
