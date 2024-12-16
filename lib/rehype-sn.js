import { SKIP, visit } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'
const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g

// Helper to safely stringify node content
function safeStringify(obj, depth = 0) {
  if (depth > 2) return '[Nested Object]' // Prevent infinite recursion
  try {
    return JSON.stringify(obj, (key, value) => {
      if (key === 'parent') return '[Parent]' // Skip circular parent refs
      if (typeof value === 'object' && value !== null && depth < 2) {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, safeStringify(v, depth + 1)])
        )
      }
      return value
    }, 2)
  } catch (e) {
    return String(obj)
  }
}

// Helper to print node info
function logNode(prefix, node, detailed = false) {
  const nodeInfo = {
    type: node.type,
    tagName: node.tagName,
    childCount: node.children?.length,
    value: node.type === 'text' || node.type === 'raw' 
      ? node.value.substring(0, 100) + (node.value.length > 100 ? '...' : '')
      : undefined,
    properties: node.properties
  }
  
  console.log(`${prefix} Node:`, safeStringify(nodeInfo))
  
  if (detailed && node.children?.length > 0) {
    console.log(`${prefix} Children:`)
    node.children.forEach((child, i) => {
      logNode(`${prefix}   [${i}]`, child)
    })
  }
}

export default function rehypeSN(options = {}) {
  const { stylers = [] } = options

  return function transformer(tree) {
    try {
      visit(tree, (node, index, parent) => {
        // Handle details/summary tags
        if (node.type === 'raw' && node.value.includes('<details>')) {
          console.log('\n🔍 Found details tag at index:', index)
          logNode('📌 Details', node, true)
          
          const detailsContent = {
            summary: {
              content: [],
              found: false,
              complete: false
            },
            content: [],
            startIndex: index,
            endIndex: index
          }

          // Handle self-contained details block
          if (node.value.includes('</details>')) {
            console.log('📍 Found self-contained details block')
            let content = node.value
            
            // Extract summary if present
            const summaryMatch = content.match(/<summary>(.*?)<\/summary>/s)
            if (summaryMatch) {
              console.log('📌 Found summary in self-contained block:', {
                fullMatch: summaryMatch[0],
                content: summaryMatch[1].trim()
              })
              detailsContent.summary.content.push({
                type: 'text',
                value: summaryMatch[1].trim()
              })
              detailsContent.summary.complete = true
              content = content.replace(/<summary>.*?<\/summary>/s, '')
            }
            
            // Clean remaining content
            const cleanedContent = content
              .replace(/<details>/g, '')
              .replace(/<\/details>/g, '')
              .trim()
            
            if (cleanedContent) {
              console.log('📝 Keeping content from self-contained block:', cleanedContent)
              detailsContent.content.push({
                type: 'text',
                value: cleanedContent
              })
            }

            return createDetailsElement(detailsContent, parent, index)
          }

          // Clean opening details tag and handle potential summary
          let cleanedContent = node.value.replace(/<details>/g, '')
          
          // Check for summary in opening node
          const summaryMatch = cleanedContent.match(/<summary>(.*?)<\/summary>/s)
          if (summaryMatch) {
            console.log('\n📌 Found summary in opening details node:', {
              fullMatch: summaryMatch[0],
              content: summaryMatch[1].trim()
            })
            detailsContent.summary.content.push({
              type: 'text',
              value: summaryMatch[1].trim()
            })
            detailsContent.summary.complete = true
            cleanedContent = cleanedContent.replace(/<summary>.*?<\/summary>/s, '')
          }
          
          if (cleanedContent.trim()) {
            console.log('📝 Keeping content from opening tag node:', cleanedContent)
            detailsContent.content.push({
              type: 'text',
              value: cleanedContent.trim()
            })
          }

          // Collect remaining content
          console.log('\n📝 Starting content collection...')
          let currentIndex = index
          let foundClosing = false
          
          while (currentIndex < parent.children.length) {
            const currentNode = parent.children[++currentIndex]
            if (!currentNode) break
            
            console.log(`\n👀 Examining node at index ${currentIndex}:`)
            logNode('   ', currentNode)
            
            // Handle summary tags if we haven't found a complete summary yet
            if (!detailsContent.summary.complete) {
              if (currentNode.type === 'raw' && currentNode.value.includes('<summary>')) {
                console.log('\n📌 Found summary tag in node:', {
                  type: currentNode.type,
                  value: currentNode.value
                })
                detailsContent.summary.found = true
                const summaryMatch = currentNode.value.match(/<summary>(.*?)<\/summary>/s)
                if (summaryMatch) {
                  // Keep any text that appears before the summary tag
                  const beforeSummary = currentNode.value.substring(0, currentNode.value.indexOf('<summary>')).trim()
                  if (beforeSummary) {
                    console.log('📝 Keeping content before summary tag:', beforeSummary)
                    detailsContent.content.push({
                      type: 'text',
                      value: beforeSummary
                    })
                  }

                  // Complete summary found in one node
                  console.log('📥 Extracted summary content:', summaryMatch[1].trim())
                  detailsContent.summary.content.push({
                    type: 'text',
                    value: summaryMatch[1].trim()
                  })
                  detailsContent.summary.complete = true

                  // Preserve text after the closing summary tag
                  const afterSummary = currentNode.value.substring(
                    currentNode.value.indexOf('</summary>') + '</summary>'.length
                  ).trim()
                  
                  if (afterSummary) {
                    console.log('📝 Keeping content after summary tag:', afterSummary)
                    detailsContent.content.push({
                      type: 'text',
                      value: afterSummary
                    })
                  }
                  continue
                }
                // If no match, it means the summary continues in next nodes
                const afterOpen = currentNode.value.replace(/<summary>/g, '').trim()
                if (afterOpen) {
                  console.log('📝 Found partial summary content:', afterOpen)
                  detailsContent.summary.content.push({
                    type: 'text',
                    value: afterOpen
                  })
                }
                continue
              }
              
              // If we're collecting summary content
              if (detailsContent.summary.found) {
                if (currentNode.type === 'raw' && currentNode.value.includes('</summary>')) {
                  const beforeClose = currentNode.value.replace(/<\/summary>/g, '').trim()
                  if (beforeClose) {
                    console.log('📝 Found closing summary content:', beforeClose)
                    detailsContent.summary.content.push({
                      type: 'text',
                      value: beforeClose
                    })
                  }
                  detailsContent.summary.complete = true
                  continue
                }
                // Add to summary content
                if (currentNode.type === 'text' || currentNode.type === 'element') {
                  console.log('📝 Adding summary node:', {
                    type: currentNode.type,
                    content: currentNode.type === 'text' ? currentNode.value : '[element]'
                  })
                  detailsContent.summary.content.push(currentNode)
                  continue
                }
              }
            }

            // Check for closing details tag
            const hasClosingTag = (currentNode.type === 'raw' && currentNode.value.includes('</details>')) ||
                                (currentNode.type === 'element' && toString(currentNode).includes('</details>'))
            
            if (hasClosingTag) {
              let cleanedContent
              if (currentNode.type === 'raw') {
                const textBeforeClosing = currentNode.value.substring(0, currentNode.value.indexOf('</details>'))
                if (textBeforeClosing.includes('\n')) {
                  // Parse as markdown
                  const mdast = fromMarkdown(textBeforeClosing, {
                    extensions: [gfm()],
                    mdastExtensions: [gfmFromMarkdown()]
                  })
                  // Convert to hast
                  const hast = toHast(mdast)
                  // Add all children from the parsed content
                  if (hast && hast.children) {
                    detailsContent.content.push(...hast.children)
                  }
                } else {
                  // Single line, keep as text node
                  if (textBeforeClosing.trim()) {
                    detailsContent.content.push({
                      type: 'text',
                      value: textBeforeClosing.trim()
                    })
                  }
                }
              } else {
                // Handle element nodes similarly
                const content = toString(currentNode).replace(/<\/details>/g, '')
                if (content.trim()) {
                  const mdast = fromMarkdown(content, {
                    extensions: [gfm()],
                    mdastExtensions: [gfmFromMarkdown()]
                  })
                  const hast = toHast(mdast)
                  if (hast && hast.children) {
                    detailsContent.content.push(...hast.children)
                  }
                }
              }

              console.log('✅ Found closing details tag')
              detailsContent.endIndex = currentIndex
              foundClosing = true
              break
            }

            // Add to main content if not part of summary
            if (currentNode.type === 'text' || currentNode.type === 'element') {
              detailsContent.content.push(currentNode)
            }
          }

          if (!foundClosing) {
            console.log('⚠️ No closing tag found, skipping...')
            return SKIP
          }

          // Add comprehensive logging of collected content
          console.log('\n📦 Final collected content:', {
            summary: {
              complete: detailsContent.summary.complete,
              nodeCount: detailsContent.summary.content.length,
              nodes: detailsContent.summary.content.map(node => ({
                type: node.type,
                tagName: node.tagName,
                value: node.type === 'text' ? node.value : undefined,
                childCount: node.children?.length,
                properties: node.properties
              }))
            },
            content: {
              nodeCount: detailsContent.content.length,
              nodes: detailsContent.content.map(node => ({
                type: node.type,
                tagName: node.tagName,
                value: node.type === 'text' ? node.value : undefined,
                childCount: node.children?.length,
                properties: node.properties
              }))
            }
          })

          return createDetailsElement(detailsContent, parent, index)
        }

        // Leave all other existing handlers unchanged
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

      return tree
    } catch (error) {
      console.error('❌ Error in rehypeSN transformer:', error)
      return tree
    }
  }
}

function isImageOnlyParagraph(node) {
  return node &&
    node.tagName === 'p' &&
    Array.isArray(node.children) &&
    node.children.every(child =>
      (child.tagName === 'img') ||
      (child.type === 'text' && typeof child.value === 'string' && !child.value.trim())
    )
}

function replaceMention(value, username) {
  return {
    type: 'element',
    tagName: 'mention',
    properties: { href: '/' + username, name: username },
    children: [{ type: 'text', value }]
  }
}

function replaceSub(value, sub) {
  return {
    type: 'element',
    tagName: 'sub',
    properties: { href: '/~' + sub, name: sub },
    children: [{ type: 'text', value }]
  }
}

function replaceNostrId(value, id) {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: `https://njump.me/${id}` },
    children: [{ type: 'text', value }]
  }
}

function isMisleadingLink(text, href) {
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

// Helper to create details element
function createDetailsElement(detailsContent, parent, index) {
  console.log('\n🔨 Creating details element with:', {
    hasSummary: detailsContent.summary.complete,
    contentNodes: detailsContent.content.length
  })

  const detailsElement = {
    type: 'element',
    tagName: 'details',
    properties: {},
    children: []
  }

  // Add summary if found
  if (detailsContent.summary.complete) {
    const summaryElement = {
      type: 'element',
      tagName: 'summary',
      properties: {},
      children: detailsContent.summary.content
    }
    detailsElement.children.push(summaryElement)
    console.log('✨ Added summary element')
  }

  // Add main content
  detailsElement.children.push(...detailsContent.content)
  console.log('✨ Added content elements')

  // Replace nodes
  parent.children.splice(
    detailsContent.startIndex,
    detailsContent.endIndex - detailsContent.startIndex + 1,
    detailsElement
  )

  return [SKIP, detailsContent.endIndex]
}