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

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
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
        if (node.type === 'raw' && node.value.includes('<details>')) {
          console.log('Details tag found')
          
          // Find all content between opening and closing details tags
          let detailsContent = []
          let summaryText = ''
          let i = index
          let foundClosingTag = false
          let inSummary = false
          
          // First check if opening and closing tags are in the same node
          if (node.value.includes('</details>')) {
            // Extract content between tags from single node
            const content = node.value.slice(
              node.value.indexOf('<details>') + 9,
              node.value.indexOf('</details>')
            )
            
            // Check for summary tag
            if (content.includes('<summary>')) {
              const summaryStart = content.indexOf('<summary>') + 9
              const summaryEnd = content.indexOf('</summary>')
              summaryText = content.slice(summaryStart, summaryEnd).trim()
              
              // Get content after summary
              const afterSummary = content.slice(summaryEnd + 10).trim()
              if (afterSummary) {
                detailsContent.push({
                  type: 'text',
                  value: afterSummary
                })
              }
            } else {
              // No summary tag, use content as-is
              detailsContent.push({
                type: 'text', 
                value: content.trim()
              })
            }
            
            foundClosingTag = true
            i = index
            
          } else {
            // Need to traverse nodes to find closing tag
            while (i < parent.children.length) {
              const currentNode = parent.children[i]
              
              // Check if we've hit the closing tag
              if (currentNode.type === 'raw' && currentNode.value.includes('</details>')) {
                // Get any content before closing tag
                const beforeClosing = currentNode.value.slice(0, currentNode.value.indexOf('</details>')).trim()
                if (beforeClosing) {
                  detailsContent.push({
                    type: 'text',
                    value: beforeClosing
                  })
                }
                foundClosingTag = true
                break
              }

              // Handle summary tags
              if (currentNode.type === 'raw' && currentNode.value.includes('<summary>')) {
                inSummary = true
                // Get content after summary opening tag
                const afterOpening = currentNode.value.slice(currentNode.value.indexOf('<summary>') + 9).trim()
                if (afterOpening) {
                  summaryText += afterOpening
                }
              } else if (currentNode.type === 'raw' && currentNode.value.includes('</summary>')) {
                inSummary = false
                // Get content before summary closing tag
                const beforeClosing = currentNode.value.slice(0, currentNode.value.indexOf('</summary>')).trim()
                if (beforeClosing) {
                  summaryText += beforeClosing
                }
              } else if (inSummary) {
                // Collect summary text
                if (currentNode.type === 'text') {
                  summaryText += currentNode.value
                } else if (currentNode.type === 'element') {
                  summaryText += toString(currentNode)
                }
              } else if (!inSummary && i > index) {
                // Skip the opening details node content
                if (currentNode.type === 'text' || currentNode.type === 'element') {
                  detailsContent.push(currentNode)
                } else if (currentNode.type === 'raw' && !currentNode.value.includes('<details>')) {
                  detailsContent.push({
                    type: 'text',
                    value: currentNode.value
                  })
                }
              }

              i++
            }
          }

          // Only process if we found a proper closing tag
          if (foundClosingTag) {
            // Convert collected content nodes to markdown string
            const markdownContent = detailsContent
              .map(node => toString(node))
              .join('\n')
              .trim()

            // Use helper to create new details structure
            const newDetailsNode = alternateCreateDetails(
              markdownContent,
              summaryText.trim() || 'Details'
            )

            console.log('Details content:', {
              markdownContent,
              summaryText: summaryText.trim(),
              detailsContent,
              newDetailsNode
            })

            // Replace original nodes with new details structure
            parent.children.splice(index, i - index + 1, newDetailsNode)

            return index
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
  function createDetails (markdownContent, summaryText) {
    return {
      type: 'element',
      tagName: 'details',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'summary',
          properties: {},
          children: [{ type: 'text', value: summaryText }]
        },
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: markdownContent.split('\n').map(line => ({
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [{ type: 'text', value: line }]
          }))
        }
      ]
    }
  }
  function alternateCreateDetails(markdownContent, summaryText) {
    // Parse markdown content into mdast (markdown abstract syntax tree)
    const mdastContent = fromMarkdown(markdownContent, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()]
    })
  
    // Convert mdast to hast (HTML abstract syntax tree)
    const hastContent = toHast(mdastContent)
  
    return {
      type: 'element',
      tagName: 'details',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'summary',
          properties: {},
          children: [{ type: 'text', value: summaryText }]
        },
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: hastContent.children
        }
      ]
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
