import { visit, SKIP } from 'unist-util-visit'
import { parseEmbedUrl, parseInternalLinks } from './url'
import { slug } from 'github-slugger'
import { toString } from 'mdast-util-to-string'

const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const mentionRegex = new RegExp('@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const subRegex = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const nostrIdRegex = /\b((npub1|nevent1|nprofile1|note1|naddr1)[02-9ac-hj-np-z]+)\b/g

// Helper function to create a summary node
function createSummaryNode(content) {
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
function extractSummary(content) {
  if (!content.includes('<summary>')) return { summary: null, rest: content }
  
  const [before, ...afterOpen] = content.split('<summary>')
  const [summaryContent, ...afterClose] = afterOpen.join('<summary>').split('</summary>')
  
  return {
    summary: summaryContent.trim(),
    rest: (before + afterClose.join('</summary>')).trim()
  }
}

export default function rehypeSN (options = {}) {
  const { stylers = [] } = options

  return function transformer (tree) {
    try {
      let detailsNode = null
      let nodesToRemove = []
      let startIndex = null
      let currentParent = null

      visit(tree, (node, index, parent) => {
        console.log('\nVisiting node:', {
          type: node.type,
          value: node.type === 'raw' ? node.value.slice(0, 50) + '...' : undefined,
          tagName: node.tagName,
          childCount: node.children?.length,
          parentType: parent?.type,
          isRoot: parent === tree
        })

        // Only process root-level nodes
        if (parent && parent !== tree) {
          console.log('Skipping non-root node')
          return
        }

        // Start of details section
        if (node.type === 'raw' && node.value.includes('<details>')) {
          console.log('Found details opening tag')

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
          const [_, ...rest] = node.value.split('<details>')
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

          console.log('Details transformation complete:', {
            startIndex,
            nodesRemoved: nodesToRemove.length,
            childrenCount: detailsNode.children.length
          })

          // Reset collection state
          detailsNode = null
          nodesToRemove = []
          startIndex = null
          currentParent = null

          return SKIP
        }

        // Collect nodes between details tags
        if (detailsNode) {
          console.log('Adding node to details:', {
            type: node.type,
            tagName: node.tagName,
            childCount: node.children?.length
          })
          
          detailsNode.children.push(node)
          nodesToRemove.push(node)
          return SKIP
        }
      })

    } catch (error) {
      console.error('Error in rehypeSN transformer:', error)
    }

    return tree
  }
}
