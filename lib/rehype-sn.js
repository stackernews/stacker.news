import { SKIP, visit } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toHast } from 'mdast-util-to-hast'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g

function alternateCreateDetails(markdownContent, summaryText) {
  // Parse both summary and content as markdown
  const mdastSummary = fromMarkdown(summaryText, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })

  const mdastContent = fromMarkdown(markdownContent, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  })

  // Convert both to hast
  const hastSummary = toHast(mdastSummary)
  const hastContent = toHast(mdastContent)

  // For summary, we want to ensure the content stays inline
  // If hastSummary has block elements, we need to extract their text content
  const flattenBlockElements = (node) => {
    if (node.type === 'text') return [node]
    if (!node.children) return []
    
    return node.children.flatMap(child => {
      if (child.type === 'text') return [child]
      if (child.type === 'element') {
        // Convert block elements to spans to keep them inline
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(child.tagName)) {
          return child.children.flatMap(flattenBlockElements)
        }
        return [child]
      }
      return flattenBlockElements(child)
    })
  }

  const summaryChildren = hastSummary.children.flatMap(flattenBlockElements)

  // Create the details structure
  return {
    type: 'element',
    tagName: 'details',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'summary',
        properties: {},
        children: summaryChildren
      },
      // For the content, we want to preserve block formatting
      ...hastContent.children
    ]
  }
}

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      let detailsStack = []  // Track nested details processing

      visit(tree, (node, index, parent) => {
        // Log node info for debugging
        const nodeInfo = {
          ...(node.type && { type: node.type }),
          ...(node.tagName && { tagName: node.tagName }),
          ...(node.properties && { properties: node.properties }),
          ...(node.value && { value: node.value }),
          ...(node.children && { children: `${node.children.length} children` }),
          ...(parent?.type && { parentType: parent.type }),
          ...(parent?.tagName && { parentTagName: parent.tagName }),
          index
        }
        console.log('Node:', nodeInfo)

        // Handle details tags
        if (node.type === 'raw' && (
          node.value.includes('<details>') || 
          node.value.includes('<details >')
        )) {
          console.log('Details opening tag found')
          
          // Check if this is a single-line details tag
          if (node.value.includes('</details>')) {
            // Extract content between tags
            const fullContent = node.value
            let content = fullContent
              .replace(/<details>|<details >/, '')
              .replace('</details>', '')
            
            let summaryText = 'Details'
            
            // Check for summary tags
            if (content.includes('<summary>') && content.includes('</summary>')) {
              const summaryStart = content.indexOf('<summary>') + 9
              const summaryEnd = content.indexOf('</summary>')
              summaryText = content.slice(summaryStart, summaryEnd)
              
              // Get content before and after summary
              const beforeSummary = content.slice(0, content.indexOf('<summary>')).trim()
              const afterSummary = content.slice(summaryEnd + 10).trim()
              
              content = [beforeSummary, afterSummary].filter(Boolean).join('\n')
            }
            
            // Create the details node directly
            const newDetailsNode = alternateCreateDetails(
              content.trim(),
              summaryText
            )
            
            // Replace the current node
            parent.children[index] = newDetailsNode
            return index
          }
          
          // Initialize details processing state for multi-line case
          detailsStack.push({
            startIndex: index,
            contentBuffer: [],
            summaryBuffer: [],
            inSummary: false,
            foundSummary: false,
            summaryText: '',
            detailsContent: [],
            processedNodes: new Set() // Track which nodes we've processed
          })

          return
        }

        // Process details content if we're inside a details tag
        if (detailsStack.length > 0) {
          const state = detailsStack[detailsStack.length - 1]
          
          // Skip if we've already processed this node
          if (state.processedNodes.has(index)) {
            return
          }
          state.processedNodes.add(index)

          // Check for closing details tag
          if (node.type === 'raw' && node.value.includes('</details>')) {
            console.log('Details closing tag found')
            detailsStack.pop()
            
            // Get any content before the closing tag
            const beforeClosing = node.value.split('</details>')[0]
            if (beforeClosing) {
              state.contentBuffer.push(beforeClosing)
            }

            // Process all collected content
            const content = state.contentBuffer
              .filter(Boolean) // Remove empty strings
              .join('\n')
              .replace(/\n{3,}/g, '\n\n') // Replace 3 or more newlines with 2
              .trim()

            // Create the details node
            const markdownContent = state.detailsContent
              .map(node => toString(node))
              .join('\n')

            const newDetailsNode = alternateCreateDetails(
              content || markdownContent,
              state.summaryText ? state.summaryText.trim() : 'Details'
            )

            // Replace all nodes from start to current with new details node
            parent.children.splice(state.startIndex, index - state.startIndex + 1, newDetailsNode)
            
            return state.startIndex
          }

          // Handle summary tags
          if (node.type === 'raw' && node.value.includes('<summary>')) {
            state.inSummary = true
            state.foundSummary = true
            const parts = node.value.split('<summary>')
            if (parts[0]) {
              state.contentBuffer.push(parts[0])
            }
            if (parts[1]) {
              state.summaryBuffer.push(parts[1])
            }
          } else if (node.type === 'raw' && node.value.includes('</summary>')) {
            state.inSummary = false
            const parts = node.value.split('</summary>')
            if (parts[0]) {
              state.summaryBuffer.push(parts[0])
            }
            if (parts[1]) {
              state.contentBuffer.push(parts[1])
            }
            state.summaryText = state.summaryBuffer.join('\n')
          } else if (state.inSummary) {
            // Collect summary text
            if (node.type === 'text' || node.type === 'raw') {
              state.summaryBuffer.push(node.value)
            } else if (node.type === 'element') {
              state.summaryBuffer.push(toString(node))
            }
          } else {
            // Handle content collection
            if (node.type === 'text') {
              // Only add non-empty text nodes or preserve single newlines
              if (node.value.trim() || node.value === '\n') {
                state.contentBuffer.push(node.value)
              }
            } else if (node.type === 'element') {
              state.contentBuffer.push(toString(node))
            } else if (node.type === 'raw' && 
                       !node.value.includes('<details>') &&
                       !node.value.includes('</details>')) {
              state.contentBuffer.push(node.value)
            }
          }

          return
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

      return tree
    } catch (error) {
      console.error('Error in rehypeSN transformer:', error)
      return tree
    }
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


// Different structures that must be handled properly and not break details/summary

// Structure 1:

// <details>no summary tags
// lorem ipsum
// and text on a new line</details>

// ----------

// Structure 2:

// <details>
// <summary>text inside summary</summary>

// lorem ipsum
// </details>

// ----------

// Structure 3:

// <details>
//     <summary>summary indentation single line</summary>
// 1. first thing
// 2. second thing 
// 3. third thing
// </details>

// ----------

// Structure 4:

// <details>
//   <summary>
//     summary text here
//   </summary>
//   text inside details with *markdown* working **properly**
// </details>

// ----------

// Structure 5:

// <details>
// <summary>Shopping list</summary>
// - Vegetables
// - Fruits
// - Fish
// </details>
