import { SKIP, visit } from 'unist-util-visit'
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
      visit(tree, (node, index, parent) => {
        
        // Handle raw HTML content that might be details/summary tags
        if (node.type === 'raw') {
          const value = node.value.trim()
          
          // Check if this is a details tag (single-line or multi-line)
          if (value.includes('<details>')) {
            const detailsNode = {
              type: 'element',
              tagName: 'details',
              properties: {
                className: ['collapsable-details']
              },
              children: []
            }
            
            // Extract content between details tags
            const detailsContent = value.replace(/<\/?details>/g, '').trim()
            
            // Check for summary tag
            const summaryMatch = detailsContent.match(/<summary>([\s\S]*?)<\/summary>([\s\S]*)/)
            if (summaryMatch) {
              // Add summary element
              detailsNode.children.push({
                type: 'element',
                tagName: 'summary',
                properties: {
                  className: ['collapsable-summary']
                },
                children: [{
                  type: 'text',
                  value: summaryMatch[1].trim()
                }]
              })
              
              // Add remaining content
              if (summaryMatch[2].trim()) {
                detailsNode.children.push({
                  type: 'text',
                  value: summaryMatch[2].trim()
                })
              }
            } else {
              // No summary found, add all content
              detailsNode.children.push({
                type: 'text',
                value: detailsContent
              })
            }
            
            // Replace the raw node with our new details element
            parent.children[index] = detailsNode
            return [SKIP]
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
          // Handle details/summary tags
          for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i]
            
            console.log('Checking child:', child?.type, child?.value?.trim())
            
            // Convert raw <details> tags into elements
            if (child?.type === 'raw' && child.value.trim() === '<details>') {
              console.log('Found details tag at index:', i)
              const detailsNode = {
                type: 'element',
                tagName: 'details',
                properties: {
                  className: []  // Initialize with empty array
                },
                children: []
              }
              
              // Collect children until we find the closing tag
              let j = i + 1
              while (j < node.children.length) {
                const current = node.children[j]
                if (current?.type === 'raw' && current.value.trim() === '</details>') {
                  break
                }
                detailsNode.children.push(current)
                j++
              }
              
              // Add default summary if none exists
              if (!detailsNode.children.some(c => 
                (c.type === 'raw' && c.value.includes('<summary>')) || 
                (c.type === 'element' && c.tagName === 'summary')
              )) {
                detailsNode.children.unshift({
                  type: 'element',
                  tagName: 'summary',
                  properties: {
                    className: []  // Initialize with empty array
                  },
                  children: [{ type: 'text', value: 'Details' }]
                })
              }
              
              // Convert any raw summary tags in the children 
              for (let k = 0; k < detailsNode.children.length; k++) {
                const child = detailsNode.children[k]
                if (child?.type === 'raw' && child.value.trim() === '<summary>') {
                  const summaryNode = {
                    type: 'element',
                    tagName: 'summary',
                    properties: {
                      className: []  // Initialize with empty array
                    },
                    children: []
                  }
                  
                  // Collect summary content
                  let l = k + 1
                  while (l < detailsNode.children.length) {
                    const current = detailsNode.children[l]
                    if (current?.type === 'raw' && current.value.trim() === '</summary>') {
                      break
                    }
                    summaryNode.children.push(current)
                    l++
                  }
                  
                  // Replace the raw tags and content with the summary element
                  detailsNode.children.splice(k, l - k + 1, summaryNode)
                }
              }
              
              // Replace the original content with our new details element
              node.children.splice(i, j - i + 1, detailsNode)
            }
          }

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
}
